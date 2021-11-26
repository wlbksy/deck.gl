#!/bin/bash
# npm install -g pbf
# npm install -g cjs-to-es6

curl https://raw.githubusercontent.com/CartoDB/cloud-native/15a6b86e811f7a5c0ed6d1f7b6d3e2262542794f/maps-api/src/routes/v3/maps/middlewares/output/carto-tile.proto?token=AADOY67AF6BYBQCYBQWXRVTBVIPGM > carto-tile.proto
pbf carto-tile.proto | sed 's/var[^=]*= //g' > carto-tile.js
cjs-to-es6 carto-tile.js
rm carto-tile.proto
