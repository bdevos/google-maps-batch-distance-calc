"use strict";

const https = require('https');
const fs = require('fs');
const prompt = require('prompt');
const buildUrl = require('build-url');
const parse = require('csv-parse');
const transform = require('stream-transform');
const HEADER_ROW = 'Respnr;From;To;Distance (meters);Duration (seconds);Status\n';

prompt.properties = require('./prompt.properties.json');

var mode, 
	key;

var createSearchablePostcode = (postcode) => {
	if (postcode.length != 6) {
		return;
	}
	return `${postcode.substr(0, 4)} ${postcode.substr(4)} Nederland`;
};

var parser = parse({delimiter: ';'});

var transformer = transform((record, callback) => {
	if (record.length === 3 && Number.isInteger(parseInt(record[0]))) {
		let origin = createSearchablePostcode(record[1]);
		let destination = createSearchablePostcode(record[2]);

		if (!origin || !destination) {
			record.push(null);
			record.push(null);
			record.push('Invalid postcode');
			callback(null, record.join(';')+'\n');
			return;
		}

  		let url = buildUrl('https://maps.googleapis.com', {
			path: 'maps/api/distancematrix/json',
			queryParams: {
				units: 'metric',
				origins: origin,
				destinations: destination,
				mode: mode,
				key: key
			}
		});
		https.get(url, (res) => {
			var rawData = '';
			res.on('data', (chunk) => {
				rawData += chunk;
			});
			res.on('end', () => {
				let distancematrix = JSON.parse(rawData);
				if (distancematrix.status === 'OK' && distancematrix.rows[0].elements[0].status === 'OK') {
					record.push(distancematrix.rows[0].elements[0].distance.value);
					record.push(distancematrix.rows[0].elements[0].duration.value);
					record.push(distancematrix.status);
				} else {
					record.push(null);
					record.push(null);
					if (distancematrix.status !== 'OK') {
						record.push(distancematrix.status);
					} else {
						record.push(distancematrix.rows[0].elements[0].status);
					}
				}
				callback(null, record.join(';')+'\n');
			});
		}).on('error', (e) => {
			console.error(e);
		});
  	} else if (record[0] === 'Respnr') {
  		callback(null, HEADER_ROW);
	} else {
		callback();
	}
}, {parallel: 20});

prompt.start();

prompt.get(['input', 'output', 'mode', 'key'], (err, result) => {
	mode = result.mode;
	key = result.key;

	let inputStream = fs.createReadStream(result.input);
	let outputStream = fs.createWriteStream(result.output);
	
	inputStream.on('error', (err) => {
		console.error(`Input stream error: ${err.message}`);
	});
	outputStream.on('error', (err) => {
		console.error(`Output stream error: ${err.message}`);
	})
	
	inputStream
		.pipe(parser)
		.pipe(transformer)
		.pipe(outputStream);
});