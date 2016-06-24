#!/usr/bin/env node
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var bucket = process.argv[2];

s3.getObject({
	Bucket: bucket,
	Key: 'config.json'
}, function (err, data) {
	if (err) {
		console.error(err);
		process.exit(1);
	} else {
		console.log(data.Body.toString('utf8'));
		process.exit(0);
	}
});
