/* global devicePixelRatio, document, fetch, performance */
/* eslint-disable no-console */
import {diff, addedDiff, deletedDiff, updatedDiff, detailedDiff} from 'deep-object-diff';
import React, {useState} from 'react';
import {render} from 'react-dom';
import {Tile} from './carto-tile';
import Protobuf from 'pbf';
import Checkbox from './Checkbox';
import DeckGL from '@deck.gl/react';
import {ClipExtension} from '@deck.gl/extensions';
import {MVTLayer, TileLayer} from '@deck.gl/geo-layers';
import {GeoJsonLayer, PathLayer, PointCloudLayer} from '@deck.gl/layers';
import {getPolygonSignedArea} from '@math.gl/polygon';
import {MVTLoader} from '@loaders.gl/mvt';
import {binaryToGeojson, geojsonToBinary, TEST_EXPORTS} from '@loaders.gl/gis';
import {classifyRings, featuresToBinary} from '@loaders.gl/mvt';
import {testdata, correct, multipolygon} from './testdata.js';

const INITIAL_VIEW_STATE = {longitude: -73.95643, latitude: 40.8039, zoom: 9};
const COUNTRIES =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson';

const params = new URLSearchParams(location.search.slice(1));
const apiBaseUrl = 'https://direct-gcp-us-east1-19.dev.api.carto.com';
const connection = params.get('connection') || 'bigquery';
// const table = params.get('table') || 'cartodb-gcp-backend-data-team.dynamic_tiling.lines_300K_viz';
const table =
  params.get('table') || 'cartodb-gcp-backend-data-team.dynamic_tiling.polygons_3k_usacounty';

// const formatTiles = params.get('formatTiles') || 'geojson'; // mvt | geojson | binary
const geomType = params.get('geomType') || 'polygons'; // points | lines | polygons
//const token =
//  'eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfZmt0MXdsbCIsImp0aSI6IjNmM2NlMjA3In0.zzfm2xZSAjcTlLxaPQHDy8uVJbGtEC5gItOg8U_gfP4';
const token =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InlscXg0SVg3ek1oaUR1OFplSUlFSyJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImZwYWxtZXIrY2hyb21lQGNhcnRvZGIuY29tIiwiaHR0cDovL2FwcC5jYXJ0by5jb20vYWNjb3VudF9pZCI6ImFjX2ZrdDF3bGwiLCJpc3MiOiJodHRwczovL2F1dGguZGV2LmNhcnRvLmNvbS8iLCJzdWIiOiJhdXRoMHw2MWEwZDgyMGJkMDA3OTAwNzExNDViYTciLCJhdWQiOlsiY2FydG8tY2xvdWQtbmF0aXZlLWFwaSIsImh0dHBzOi8vY2FydG8tZGVkaWNhdGVkLWVudi51cy5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNjM4NDQxMDY0LCJleHAiOjE2Mzg1Mjc0NjQsImF6cCI6IkczcTdsMlVvTXpSWDhvc2htQXVzZWQwcGdRVldySkdQIiwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCByZWFkOmN1cnJlbnRfdXNlciB1cGRhdGU6Y3VycmVudF91c2VyIHJlYWQ6Y29ubmVjdGlvbnMgd3JpdGU6Y29ubmVjdGlvbnMgcmVhZDptYXBzIHdyaXRlOm1hcHMgcmVhZDphY2NvdW50IiwicGVybWlzc2lvbnMiOlsicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInVwZGF0ZTpjdXJyZW50X3VzZXIiLCJ3cml0ZTphcHBzIiwid3JpdGU6Y29ubmVjdGlvbnMiLCJ3cml0ZTppbXBvcnRzIiwid3JpdGU6bWFwcyIsIndyaXRlOnRva2VucyJdfQ.GORlsUyCVJggGjJcq-56B_Va_lpD85HEgjFlRn-CSFdS_8oS1_znONGRGWfjheps4RvQKW6f7hZii07ZQOeTHgwbr9WyrFqubBXPN1uKBQIg2_uKEVV8ITaOgt5NJtDvSPWyehoO1Fh6k4HpLtseIhNRkwpcPLWG0zpORdr9e9vd3XpRTzbXwmEuuFLUH2T0RpR9ex6A3H62aV1HeVsEwcwnMr_Vy3gI6S73oCa_i2G4R5X1fYFesGfAf6-94Zm6ogUfuE423usp5ehakDDhsKm6KrbmgamBG3cX7ajlGwH2T_wwlRc30L7zd9mzbTJJGzFKsoNDfbT04c14GNFvQA';

function buildUrl({formatTiles}) {
  return `${apiBaseUrl}/v3/maps/${connection}/table/{z}/{x}/{y}?name=${table}&cache=&access_token=${token}&formatTiles=${formatTiles}&geomType=${geomType}`;
}

const geojson = true;
const wip = true;
const showBasemap = true;
const showTile = false;
const showCBT = false;
const showMVT = false;
const showGeojson = true;

function Root() {
  const [binary, setBinary] = useState(false);
  const [border, setBorder] = useState(true);
  const [clip, setClip] = useState(true);
  const [skipOdd, setSkipOdd] = useState(false);
  const opts = {binary, border, clip, skipOdd};

  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[
          showBasemap && createBasemap(),
          showTile && createTile(opts),
          showCBT && createCBT(opts),
          showMVT && createMVT(opts),
          showGeojson && createGeojson(opts)
        ]}
      />
      <div style={{position: 'absolute', margin: 10}}>
        {(showTile || showGeojson) && (
          <Checkbox label="Binary" value={binary} onChange={() => setBinary(!binary)} />
        )}
        {showTile && <Checkbox label="Border" value={border} onChange={() => setBorder(!border)} />}
        <Checkbox label="Clip" value={clip} onChange={() => setClip(!clip)} />
        <Checkbox label="Skip Odd" value={skipOdd} onChange={() => setSkipOdd(!skipOdd)} />
      </div>
    </>
  );
}

function tileToBinary(tile) {
  // Convert to typed arrays
  tile.points.positions.value = new Float32Array(tile.points.positions.value);

  tile.lines.positions.value = new Float32Array(tile.lines.positions.value);
  tile.lines.pathIndices.value = new Uint16Array(tile.lines.pathIndices.value);
  tile.lines.globalFeatureIds = tile.lines.featureIds; // HACK to fix missing data from API

  tile.polygons.positions.value = new Float32Array(tile.polygons.positions.value);
  tile.polygons.polygonIndices.value = new Uint16Array(tile.polygons.polygonIndices.value);
  tile.polygons.primitivePolygonIndices.value = new Uint16Array(
    tile.polygons.primitivePolygonIndices.value
  );
  tile.polygons.globalFeatureIds = tile.polygons.featureIds; // HACK to fix missing data from API

  return {
    points: {type: 'Point', numericProps: {}, properties: [], ...tile.points},
    lines: {type: 'LineString', numericProps: {}, properties: [], ...tile.lines},
    polygons: {type: 'Polygon', numericProps: {}, properties: [], ...tile.polygons}
  };
}

function createTile({binary, border, clip, skipOdd}) {
  // const formatTiles = binary ? 'binary' : 'geojson';
  return new TileLayer({
    data: buildUrl({formatTiles: 'binary'}),
    minZoom: 0,
    maxZoom: 19,
    tileSize: 512,
    zoomOffset: devicePixelRatio === 1 ? -1 : 0,

    // Debug options
    binary,
    border,
    clip,
    skipOdd,

    getTileData: tile => {
      const {x, y, z} = tile;
      return Promise.all([
        fetch(wip ? tile.url.replace('binary', 'wip') : tile.url)
          .then(response => {
            if (response.status === 204) {
              return null;
            }
            return response.arrayBuffer();
          })
          .then(parseCBT),
        fetch(tile.url.replace('binary', 'geojson')).then(response => {
          if (response.status === 204) {
            return null;
          }
          return response.json();
        }),
        fetch(tile.url.replace('binary', 'mvt'))
          .then(response => {
            if (response.status === 204) {
              return null;
            }
            return response.arrayBuffer();
          })
          .then(arrayBuffer => {
            if (!arrayBuffer) return null;
            return MVTLoader.parse(arrayBuffer, {
              mimeType: 'application/x-protobuf',
              mvt: {
                coordinates: 'wgs84', //  'local',
                tileIndex: {x, y, z}
              },
              gis: binary ? {format: 'binary'} : {}
            });
          })
      ]);
    },
    renderSubLayers: props => {
      if (props.data[0] === null || (props.skipOdd && (props.tile.x + props.tile.y) % 2)) {
        return null;
      }

      // Debug, draw tile outline
      const {
        bbox: {west, south, east, north}
      } = props.tile;

      // Convert data to binary
      const binaryData = props.data[0]; // <- Broken
      const geojsonData = props.data[1]; // <- Working
      const mvtData = props.data[2]; // <- Working

      // Patch in byte length
      binaryData.byteLength = mvtData.byteLength;

      // const geojsonBinaryData = geojsonToBinary(geojsonData.features); // <- Broken
      // const binaryGeojsonData = binaryToGeojson(binaryData); // <- Working
      // const doubleConvertData = geojsonToBinary(binaryGeojsonData);
      const changes = detailedDiff(binaryData, mvtData);

      const tileProps = {
        // Data
        id: `${props.id}-geojson`,
        data: props.binary ? binaryData : geojsonData,

        // Styling
        stroked: true,
        filled: true,
        pointType: 'circle',
        pointRadiusUnits: 'pixels',
        lineWidthMinPixels: 0.5,
        getPointRadius: 1.5,
        getLineColor: [0, 0, 200],
        getFillColor: [255, 50, 11]
      };

      // Clipping
      if (clip) {
        tileProps.extensions = [new ClipExtension()];
        tileProps.clipBounds = [west, south, east, north];
      }

      return [
        new GeoJsonLayer(tileProps),
        border &&
          new PathLayer({
            id: `${props.id}-border`,
            visible: true,
            data: [
              [
                [west, north],
                [west, south],
                [east, south],
                [east, north],
                [west, north]
              ]
            ],
            getPath: d => d,
            getColor: [255, 0, 0, 60],
            widthMinPixels: 1
          })
      ];
    }
  });
}

function createBasemap() {
  return new GeoJsonLayer({
    id: 'base-map',
    data: COUNTRIES,
    // Styles
    stroked: true,
    filled: true,
    lineWidthMinPixels: 2,
    opacity: 0.4,
    getLineColor: [60, 60, 60],
    getFillColor: [200, 200, 200]
  });
}

const parseJSON = arrayBuffer => {
  return JSON.parse(new TextDecoder().decode(arrayBuffer));
};

const parseCBT = (arrayBuffer, options) => {
  if (!arrayBuffer) return null;
  if (geojson) return geojsonToBinary2(parseJSON(arrayBuffer).features);
  const tile = wip ? parseJSON(arrayBuffer) : parsePbf(arrayBuffer);
  const binary = tileToBinary(tile);
  return binary;
};

const CBTLoader = {
  name: 'CARTO Binary Tile',
  id: 'cbt',
  module: 'carto',
  version: 'dev',
  extensions: ['pbf'],
  mimeTypes: ['application/x-protobuf'],
  category: 'geometry',
  worker: false,
  parse: async (arrayBuffer, options) => parseCBT(arrayBuffer, options),
  parseSync: parseCBT
};

class CBTLayer extends MVTLayer {
  renderSubLayers(props) {
    if (props.data === null || (props.skipOdd && (props.tile.x + props.tile.y) % 2)) {
      return null;
    }

    props.autoHighlight = false;

    if (props.clip) {
      const {
        bbox: {west, south, east, north}
      } = props.tile;
      props.extensions = [new ClipExtension()];
      props.clipBounds = [west, south, east, north];
    }

    const subLayer = new GeoJsonLayer({
      ...props
    });
    return subLayer;
  }
}

CBTLayer.layerName = 'CBTLayer';
CBTLayer.defaultProps = {...MVTLayer.defaultProps, loaders: [CBTLoader]};

function createCBT({clip, skipOdd}) {
  const formatTiles = geojson ? 'geojson' : wip ? 'wip' : 'binary';

  return new CBTLayer({
    id: 'cbt',
    data: buildUrl({formatTiles}),

    // Styling (same props as MVTLayer)
    getFillColor: [33, 171, 251],
    getElevation: 1000,
    // extruded: true,
    stroked: true,
    filled: true,
    pointType: 'circle',
    pointRadiusUnits: 'pixels',
    lineWidthMinPixels: 0.5,
    getPointRadius: 1.5,
    getLineColor: [0, 0, 200],
    // getFillColor: [255, 50, 11],

    // Debug options
    clip,
    skipOdd
  });
}

function createMVT() {
  return new MVTLayer({
    id: 'mvt',
    data: buildUrl({formatTiles: 'mvt'}),
    getFillColor: [232, 171, 0]
  });
}

function binarizePoint(coordinates, data, lines) {
  lines.push(data.length);
  data.push(...coordinates);
}

function binarizeLineString(coordinates, data, lines) {
  lines.push(data.length);
  data.push(...coordinates.flat());
}

function binarizePolygon(coordinates, data, lines) {
  for (const lineString of coordinates) {
    binarizeLineString(lineString, data, lines);
  }
}

// Mimic output format of BVT
function binarize(features, firstPassData) {
  for (let feature of features) {
    const {geometry} = feature;
    const {coordinates, type} = geometry;
    const data = [];
    const lines = [];

    if (['MultiPolygon', 'MultiLineString', 'MultiPoint'].indexOf(type) === -1) {
      binarizePolygon(coordinates, data, lines);
    } else {
      coordinates.map(c => binarizePolygon(c, data, lines));
    }

    geometry.data = data;
    geometry.lines = lines;
    delete geometry.coordinates;

    _toBinaryCoordinates(feature, firstPassData);
  }

  return features;
}

function _toBinaryCoordinates(feature, firstPassData) {
  // Expands the protobuf data to an intermediate `lines`
  // data format, which maps closely to the binary data buffers.
  // It is similar to GeoJSON, but rather than storing the coordinates
  // in multidimensional arrays, we have a 1D `data` with all the
  // coordinates, and then index into this using the `lines`
  // parameter, e.g.
  //
  // geometry: {
  //   type: 'Point', data: [1,2], lines: [0]
  // }
  // geometry: {
  //   type: 'LineString', data: [1,2,3,4,...], lines: [0]
  // }
  // geometry: {
  //   type: 'Polygon', data: [1,2,3,4,...], lines: [[0, 2]]
  // }
  // Thus the lines member lets us look up the relevant range
  // from the data array.
  // The Multi* versions of the above types share the same data
  // structure, just with multiple elements in the lines array

  let geom = feature.geometry;

  const coordLength = 2;

  // eslint-disable-next-line default-case
  switch (geom.type) {
    case 'Point': // Point
    case 'MultiPoint': // Point
      firstPassData.pointFeaturesCount++;
      firstPassData.pointPositionsCount += geom.lines.length;
      break;

    case 'LineString': // LineString
    case 'MultiLineString': // LineString
      firstPassData.lineFeaturesCount++;
      firstPassData.linePathsCount += geom.lines.length;
      firstPassData.linePositionsCount += geom.data.length / coordLength;
      break;

    case 'Polygon': // Polygon
    case 'MultiPolygon': // Polygon
      const classified = classifyRings(geom);

      // Unlike Point & LineString geom.lines is a 2D array, thanks
      // to the classifyRings method
      firstPassData.polygonFeaturesCount++;
      firstPassData.polygonObjectsCount += classified.lines.length;

      for (const lines of classified.lines) {
        firstPassData.polygonRingsCount += lines.length;
      }
      firstPassData.polygonPositionsCount += classified.data.length / coordLength;

      geom = classified;
      break;
  }

  feature.geometry = {...feature.geometry, ...geom};
}

function geojsonToBinary2(features) {
  const firstPassData = {
    pointPositionsCount: 0,
    pointFeaturesCount: 0,
    linePositionsCount: 0,
    linePathsCount: 0,
    lineFeaturesCount: 0,
    polygonPositionsCount: 0,
    polygonObjectsCount: 0,
    polygonRingsCount: 0,
    polygonFeaturesCount: 0
  };

  const _features = JSON.parse(JSON.stringify(features));
  const intermediateData = binarize(_features, firstPassData);
  const binaryData = featuresToBinary(intermediateData, firstPassData);

  return binaryData;
}

function createGeojson({binary}) {
  return new GeoJsonLayer({
    id: 'geojson',
    data: binary ? geojsonToBinary2(multipolygon.features) : multipolygon,
    stroked: true,
    lineWidthMinPixels: 0.5,
    getFillColor: [0, 171, 255],
    getFillColor: [232, 171, 0]
  });
}

function parsePbf(buffer) {
  const pbf = new Protobuf(buffer);
  const tile = Tile.read(pbf);
  return tile;
}

render(<Root />, document.body.appendChild(document.createElement('div')));
