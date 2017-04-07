"use strict";

const https = require('https');
const fs = require('fs');
const prompt = require('prompt');
const buildUrl = require('build-url');
const parse = require('csv-parse');
const transform = require('stream-transform');
const HEADER_ROW = 'Respnr;Resp;Ver;Distance (meters);Duration (seconds);Status\n';

prompt.properties = require('./prompt.properties.json');

var mode, key;
var parser = parse({delimiter: ';'});

var createSearchableAddress = (street, houseNumber, addition, postcode, city) => {
  return `${street} ${houseNumber}${addition}, ${postcode} ${city}`;
};

var transformer = transform((record, callback) => {
  if (record.length === 12 && Number.isInteger(parseInt(record[1]))) {
    let origin = createSearchableAddress(record[2], record[3], record[4], record[5], record[6]);
    let destination = createSearchableAddress(record[7], record[8], record[9], record[10], record[11]);
    var returnValues = [record[1], origin, destination];

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
          returnValues.push(distancematrix.rows[0].elements[0].distance.value);
          returnValues.push(distancematrix.rows[0].elements[0].duration.value);
          returnValues.push(distancematrix.status);
        } else {
          returnValues.push(null);
          returnValues.push(null);
          if (distancematrix.status !== 'OK') {
            returnValues.push(distancematrix.status);
          } else {
            returnValues.push(distancematrix.rows[0].elements[0].status);
          }
        }
        callback(null, returnValues.join(';')+'\n');
      });
    }).on('error', (e) => {
      console.error(e);
    });
  } else if (record[1] === 'Respnr') {
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
