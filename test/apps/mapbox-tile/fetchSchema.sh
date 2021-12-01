#!/bin/bash
# npm install -g pbf
# npm install -g cjs-to-es6

curl https://raw.githubusercontent.com/CartoDB/cloud-native/7a7b0bd9932c3def881cf85e287adb89d5855b3d/maps-api/src/routes/v3/maps/middlewares/output/carto-tile.proto?token=AADOY632M7FZRSDWRKCGFWLBWB6JM > carto-tile.proto
pbf carto-tile.proto | sed 's/var[^=]*= //g' > carto-tile.js
cjs-to-es6 carto-tile.js
rm carto-tile.proto
