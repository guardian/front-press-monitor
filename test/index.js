const tap = require('tap');
const lambda = require('../tmp/lambda/index').default;

const collectionJson = {
	fronts: {
		one: {},
		two: {},
		apple: { priority: 'commercial' },
		pear: { priority: 'commercial' }
	},
	collections: {}
};
const silentLogger = { log () {}, error () {} };
const frontendPressStale = (function (now) {
	const oneHourAgo = new Date(now.getTime());
	oneHourAgo.setHours(oneHourAgo.getHours() - 1);
	return {
		options: { pressedTable: 'table' },
		AWS: {
			batchGetItem (obj, cb) {
				cb(null, {
					Responses: {
						table: [{
							frontId: { S: 'one' },
							pressedTime: { S: oneHourAgo.toString() }
						},
						// two was never pressed
						{
							frontId: { S: 'apple' },
							pressedTime: { S: (new Date()).toString() }
						}, {
							frontId: { S: 'pear' },
							pressedTime: { S: (new Date()).toString() }
						}]
					}
				});
			}
		}
	};
})(new Date());
const frontendPressRecent = (function () {
	return {
		options: { pressedTable: 'table' },
		AWS: {
			batchGetItem (obj, cb) {
				cb(null, {
					Responses: {
						table: [{
							frontId: { S: 'one' },
							pressedTime: { S: (new Date()).toString() }
						}, {
							frontId: { S: 'two' },
							pressedTime: { S: (new Date()).toString() }
						}, {
							frontId: { S: 'apple' },
							pressedTime: { S: (new Date()).toString() }
						}, {
							frontId: { S: 'pear' },
							pressedTime: { S: (new Date()).toString() }
						}]
					}
				});
			}
		}
	};
})(new Date());

tap.test('fails if the config is not available', test => {
	test.plan(2);

	const cmsfronts = {
		options: {},
		AWS: {
			getObject (obj, cb) {
				cb(new Error('Invalid config'));
			}
		}
	};

	return lambda({cmsfronts, logger: silentLogger})
	.catch(error => {
		test.type(error, Error);
		test.match(error.message, /invalid config/i);
	});
});

tap.test('fails if the pressed json are not available', test => {
	test.plan(2);

	const cmsfronts = {
		options: {},
		AWS: {
			getObject (obj, cb) {
				cb(null, collectionJson);
			}
		}
	};
	const frontend = {
		options: { pressedTable: 'table' },
		AWS: {
			batchGetItem (obj, cb) {
				cb(new Error('Invalid dynamo'));
			}
		}
	};

	return lambda({cmsfronts, frontend, logger: silentLogger})
	.catch(error => {
		test.type(error, Error);
		test.match(error.message, /invalid dynamo/i);
	});
});

tap.test('does nothing when all fronts are pressed recently', test => {
	const cmsfronts = {
		options: {},
		AWS: {
			getObject (obj, cb) {
				cb(null, collectionJson);
			}
		}
	};

	return lambda({cmsfronts, frontend: frontendPressRecent, logger: silentLogger})
	.then(result => {
		test.deepEqual(result, {
			checked: 4,
			stale: 0
		});
	});
});

tap.test('alert if some fronts are stale', test => {
	const cmsfronts = {
		options: {},
		AWS: {
			getObject (obj, cb) {
				cb(null, collectionJson);
			}
		}
	};
	const email = {
		invoke (request, cb) {
			const payload = JSON.parse(request.Payload).env;
			test.equal(payload.checked, 4, 'checked');
			test.equal(payload.stale, 2, 'stale');
			test.ok(['one', 'two'].indexOf(payload.list[0]) !== -1, 'first front name ' + payload.list[0]);
			test.ok(['one', 'two'].indexOf(payload.list[1]) !== -1, 'second front name ' + payload.list[1]);
			cb();
		}
	};

	return lambda({cmsfronts, frontend: frontendPressStale, lambda: email, logger: silentLogger})
	.then(result => {
		test.deepEqual(result, {
			checked: 4,
			stale: 2
		});
	});
});

tap.test('fails if email sending does not work', test => {
	test.plan(4);
	const cmsfronts = {
		options: {},
		AWS: {
			getObject (obj, cb) {
				cb(null, collectionJson);
			}
		}
	};
	const email = {
		invoke (request, cb) {
			const payload = JSON.parse(request.Payload).env;
			test.equal(payload.checked, 4, 'checked');
			test.equal(payload.stale, 2, 'stale');
			cb(new Error('Invalid email'));
		}
	};

	return lambda({cmsfronts, frontend: frontendPressStale, lambda: email, logger: silentLogger})
	.catch(error => {
		test.type(error, Error);
		test.match(error.message, /invalid email/i);
	});
});
