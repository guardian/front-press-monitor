import AWS from 'aws-sdk';
import config from '../tmp/config.json';
import {Client, Config, Press} from 'aws-s3-facia-tool';
import { subtract, isBefore } from 'compare-dates';

const EDITORIAL_STALE = [30, 'minutes'];
const COMMERCIAL_STALE = [3, 'hours'];

export function handler (events, context, callback) {
	const lambda = new AWS.Lambda();
	const cmsfronts = new Client({
		bucket: config.buckets.cmsfronts.name,
		env: 'PROD',
		configKey: config.buckets.config
	});
	const frontend = new Client({
		bucket: config.buckets.frontend.name,
		env: 'PROD',
		pressedPrefix: 'frontsapi/pressed'
	});
	const providerChain = new AWS.CredentialProviderChain();
	providerChain.providers.splice(0, 0, new AWS.SharedIniFileCredentials({profile: 'frontend'}));
	frontend.AWS.setS3(new AWS.S3({
		credentials: null,
		credentialProvider: providerChain
	}));

	handleEvents({cmsfronts, frontend, lambda})
	.then(() => callback())
	.catch(callback);
}

export default function handleEvents ({cmsfronts, frontend, lambda, logger = console}) {
	return Config(cmsfronts).fetch().then(config => {
		const checkThese = [
			...pickRandom(2)(config.listFrontsIds('editorial')).map(front => staleIfBefore(front, EDITORIAL_STALE)),
			...pickRandom(2)(config.listFrontsIds('commercial')).map(front => staleIfBefore(front, COMMERCIAL_STALE))
		];
		logger.log('Checking', checkThese);
		return Promise.all(checkThese.map(item =>
			Press(frontend).getLastModified(item.front, 'live').then(date => {
				item.date = date;
				return item;
			})
		))
		.then(list => alertOnStale(list, lambda));
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

function alertOnStale (list, lambda) {
	const stale = list.filter(item => isBefore(item.date, item.cutoff));
	const result = {
		checked: list.length,
		stale: stale.length
	};

	if (result.stale) {
		return new Promise((resolve, reject) => {
			lambda.invoke({
				FunctionName: config.email.lambda,
				InvocationType: 'RequestResponse',
				Payload: JSON.stringify({
					from: config.email.from,
					to: config.email.to,
					subject: 'Stale fronts',
					template: STALE_TEMPLATE,
					env: Object.assign({
						list: stale,
						faciaPath: config.facia.PROD.path
					}, result)
				})
			}, err => {
				if (err) {
					reject(err);
				} else {
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
