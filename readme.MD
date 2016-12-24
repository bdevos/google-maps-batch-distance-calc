# Google Maps Batch Distance Calculations

Helper to run a batch of postcode to postcode distance calculations in Google Maps

## Installation

- npm install
- node index.js

## How it works

The application will ask you the following four questions, after which it will trigger the Google Maps Distance Matrix API.

1. Path to input file (CSV format)
2. Path to output file
3. The travel mode (driving, walking, bicycling)
4. Your Google Maps API key

More information about the Google Maps Distance Matrix API: https://developers.google.com/maps/documentation/distance-matrix/intro