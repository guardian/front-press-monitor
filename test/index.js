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
const silentLogger = { log () {} };

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
		options: {},
		AWS: {
			headObject (obj, cb) {
				cb(new Error('Invalid press'));
			}
		}
	};

	return lambda({cmsfronts, frontend, logger: silentLogger})
	.catch(error => {
		test.type(error, Error);
		test.match(error.message, /invalid press/i);
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
	const frontend = {
		options: {},
		AWS: {
			headObject (obj, cb) {
				cb(null, { LastModified: (new Date()).toString() });
			}
		}
	};

	return lambda({cmsfronts, frontend, logger: silentLogger})
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
	const oneHourAgo = new Date();
	oneHourAgo.setHours(oneHourAgo.getHours() - 1);
	const frontend = {
		options: {},
		AWS: {
			headObject (obj, cb) {
				cb(null, { LastModified: oneHourAgo.toString() });
			}
		}
	};
	const email = {
		invoke (request, cb) {
			const payload = JSON.parse(request.Payload).env;
			test.equal(payload.checked, 4, 'checked');
			test.equal(payload.stale, 2, 'stale');
			test.ok(['one', 'two'].indexOf(payload.list[0].front) !== -1, 'first front name ' + payload.list[0].front);
			test.ok(['one', 'two'].indexOf(payload.list[1].front) !== -1, 'second front name ' + payload.list[1].front);
			cb();
		}
	};

	return lambda({cmsfronts, frontend, lambda: email, logger: silentLogger})
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
	const oneHourAgo = new Date();
	oneHourAgo.setHours(oneHourAgo.getHours() - 1);
	const frontend = {
		options: {},
		AWS: {
			headObject (obj, cb) {
				cb(null, { LastModified: oneHourAgo.toString() });
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

	return lambda({cmsfronts, frontend, lambda: email, logger: silentLogger})
	.catch(error => {
		test.type(error, Error);
		test.match(error.message, /invalid email/i);
	});
});
