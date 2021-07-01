import AWS from 'aws-sdk';
import config from '../tmp/config.json';
import {Client, Config, Press} from 'aws-s3-facia-tool';
import { subtract, isBefore } from 'compare-dates';

const EDITORIAL_STALE = [30, 'minutes'];
const COMMERCIAL_STALE = [3, 'hours'];

export function handler (events, context, callback) {
	const lambda = new AWS.Lambda();
	const ssm = new AWS.SSM();

	// The environment is hard-coded, as we don't require these alerts in CODE.
	ssm.getParameter('/front-press-monitor/PROD/config').promise.then(config => {
		const cmsfronts = new Client({
			bucket: config.buckets.cmsfronts.name,
			env: 'PROD',
			configKey: config.buckets.config
		});
		const frontend = new Client({
			bucket: config.buckets.frontend.name,
			env: 'PROD',
			pressedTable: config.facia.PROD.dynamo
		});

		return { cmsfronts, frontend };
	}).then(({ cmsfronts, frontend }) => {
		handleEvents({cmsfronts, frontend, lambda})
			.then(() => callback())
			.catch(callback);
	});
}

export default function handleEvents ({cmsfronts, frontend, lambda, logger = console}) {
	return Config(cmsfronts).fetch().then(config => {
		const checkThese = [
			...pickRandom(2)(config.listFrontsIds('editorial')).map(front => staleIfBefore(front, EDITORIAL_STALE)),
			...pickRandom(2)(config.listFrontsIds('commercial')).map(front => staleIfBefore(front, COMMERCIAL_STALE))
		];
		logger.log('Checking at', new Date(), checkThese);

		return Press(frontend)
		.batchGetLastModified(...checkThese.map(item => [item.front, 'live']))
		.then(frontsMap => alertOnStale(checkThese, frontsMap, lambda, logger));
	});
}

function staleIfBefore (front, limits) {
	return {
		front,
		cutoff: subtract(new Date(), ...limits)
	};
}

const STALE_TEMPLATE = `
I've checked {{ checked }} fronts and {{ stale }} appear stale.<br>

{% for path in list %}
<a href="{{ faciaPath }}/troubleshoot/stale/{{ path }}">{{ path }}</a><br>
{% endfor %}

Best regards
`;

function alertOnStale (list, frontsMap, lambda, logger) {
	const stale = list.filter(item => {
		const date = frontsMap[item.front];
		return !date || isBefore(date, item.cutoff);
	});
	const result = {
		checked: list.length,
		stale: stale.length
	};
	logger.log('Stale result', frontsMap, result, stale);

	if (result.stale) {
		return new Promise((resolve, reject) => {
			logger.log('Sending email');
			lambda.invoke({
				FunctionName: config.email.lambda,
				InvocationType: 'RequestResponse',
				Payload: JSON.stringify({
					from: config.email.from,
					to: config.email.to,
					subject: 'Stale fronts',
					template: STALE_TEMPLATE,
					env: Object.assign({
						list: stale.map(item => item.front),
						faciaPath: config.facia.PROD.path
					}, result)
				})
			}, err => {
				if (err) {
					logger.error('Error sending email', err.message);
					reject(err);
				} else {
					logger.log('Email sent');
					resolve(result);
				}
			});
		});
	} else {
		return result;
	}
}

function pickRandom (number) {
	return function (list) {
		return list.sort(() => Math.random() > 0.5 ? -1 : 1).slice(0, number);
	};
}
