/* global devicePixelRatio, document, fetch */
/* eslint-disable no-console */
import React, {PureComponent} from 'react';
import {render} from 'react-dom';
import Tile from './Schema';
import Protobuf from 'pbf';
import DeckGL from '@deck.gl/react';
import {MVTLayer, TileLayer} from '@deck.gl/geo-layers';
import {GeoJsonLayer, PathLayer, PointCloudLayer, ScatterplotLayer} from '@deck.gl/layers';
import {geojsonToBinary} from '@loaders.gl/gis';

// Set your mapbox token here
const MAPBOX_TOKEN = process.env.MapboxAccessToken; // eslint-disable-line

const INITIAL_VIEW_STATE = {
  bearing: 0,
  pitch: 0,
  longitude: -73.986022,
  latitude: 40.730743,
  zoom: 10
};

const COUNTRIES =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson'; //eslint-disable-line

const MVT_URL =
  'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/{z}/{x}/{y}.mvt';

// Hack static URL for now
const GEOJSON_URL =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson';

const POINTS_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/scatterplot/manhattan.json'; // eslint-disable-line

const SINGLE_TILE_URL = 'http://10.0.32.13:3000/tile';

const USE_BINARY = true;

const ALBERTO = true;
const ALBERTO_URL =
  'http://10.0.32.237:8002/v3/maps/bq-bi-engine/table/{z}/{x}/{y}?mapId=cartobq._d296517907c39746c3a5652253a82ad3ee035be5.anon3c8918185b69854ef19bcfcd5afc498070e2dfbc&format=geojson&access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJYVnRIYUdzaTUxMFZZYml1YjA5ZCJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImFsYmVydG9AY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfbWs3bXV6Z3UiLCJpc3MiOiJodHRwczovL2F1dGgubG9jYWwuY2FydG8uY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA4NDA5NTYzMzQxMzU5MDQxNjg0IiwiYXVkIjoiY2FydG8tY2xvdWQtbmF0aXZlLWFwaSIsImlhdCI6MTYzMjkxMjIzNCwiZXhwIjoxNjMyOTk4NjM0LCJhenAiOiJGM2tKOVJoUWhFTUFodDFRQllkQUluckRRTXJKVlI4dSIsInNjb3BlIjoicmVhZDpjdXJyZW50X3VzZXIiLCJwZXJtaXNzaW9ucyI6WyJhZG1pbjphY2NvdW50IiwicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInVwZGF0ZTpjdXJyZW50X3VzZXIiLCJ3cml0ZTphcHBzIiwid3JpdGU6Y29ubmVjdGlvbnMiLCJ3cml0ZTppbXBvcnRzIiwid3JpdGU6bGlzdGVkX2FwcHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIl19.SPs4WJHjwa8X8Nz8-4noZU2xQmZ8N52XZh3Gmea18-aCBQBUh9BML8WcpBYDD_LU9a02V2uG8Xp4otnkz-C1gA7idMmynthQAYSeRQWslImbjR5BwYW7l6XMTJ3fF2a2MRC6gQCtgfN45OYagvzNNBcQEn6Fffcs79BUkQsdhRctFp5AN1SU7ixevly24_BJM56vX0ihCstFhaoQiDQCX7R7MHNLFIk1RXb2xDC-3inhUzw94wetPHcQNBr5MiLQfNmJYVq_oemU7bVGsT2iIvZIghhypBy__eA_z0uwtiEAekC_01JQ-9v1_TjewmLs30qzyfNonKX32nVcjKiJuw';
const ANTONIO_URL =
  'http://10.0.32.226:8002/v3/maps/dev-bigquery/table/{z}/{x}/{y}?mapId=cartodb-gcp-backend-data-team._d296517907c39746c3a5652253a82ad3ee035be5.anon3c8918185b69854ef19bcfcd5afc498070e2dfbc&format=geojson&access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJYVnRIYUdzaTUxMFZZYml1YjA5ZCJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImFjb3J0ZXNAY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfZGEwdmpmZyIsImlzcyI6Imh0dHBzOi8vYXV0aC5sb2NhbC5jYXJ0by5jb20vIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMDMyMzk1MzA1MDY5OTQ5NTM3NzUiLCJhdWQiOiJjYXJ0by1jbG91ZC1uYXRpdmUtYXBpIiwiaWF0IjoxNjMyOTI0OTM4LCJleHAiOjE2MzMwMTEzMzgsImF6cCI6IkYza0o5UmhRaEVNQWh0MVFCWWRBSW5yRFFNckpWUjh1Iiwic2NvcGUiOiJyZWFkOmN1cnJlbnRfdXNlciIsInBlcm1pc3Npb25zIjpbImFkbWluOmFjY291bnQiLCJyZWFkOmFjY291bnQiLCJyZWFkOmFwcHMiLCJyZWFkOmNvbm5lY3Rpb25zIiwicmVhZDpjdXJyZW50X3VzZXIiLCJyZWFkOmltcG9ydHMiLCJyZWFkOmxpc3RlZF9hcHBzIiwicmVhZDptYXBzIiwicmVhZDp0aWxlc2V0cyIsInJlYWQ6dG9rZW5zIiwidXBkYXRlOmN1cnJlbnRfdXNlciIsIndyaXRlOmFwcHMiLCJ3cml0ZTpjb25uZWN0aW9ucyIsIndyaXRlOmltcG9ydHMiLCJ3cml0ZTpsaXN0ZWRfYXBwcyIsIndyaXRlOm1hcHMiLCJ3cml0ZTp0b2tlbnMiXX0.RhMht6LutV9NjEvgfyVvLMN-avUvJYowLyozMSGbjyZe59JRzd51Fv5U3W45qHIXQhMv8wj86sTDX6zsH0uMy3NOg6UsTClqwKIRNutkmQqTkNA2gJ1Qk6Dkc_Yj08RsW6jTyQhBZVTw5T6wZutmm3LcLlLHb9dMX0TrfRwblD3f-YHMxF8UVL-O8WUV9VI3rE5cwmYeP1qbGNrVkxjG3pquHXzTo_b8CrDVGbbGlVyh9M30YAYjC0rHGaPWaCqEtu6eRJPvClHqbD5qQQinCEMzS4PDh5_pyMtC1XX3gclV1mb4rlnWE7YWoywyEp4szy1__fz8tRXQp0K32VS6Ng';

const showBasemap = true;
const showMVT = false;
const showTile = true;
const showPointCloud = false;
const BORDERS = true;

const MAP_LAYER_STYLES = {
  maxZoom: 14,

  getFillColor: f => {
    switch (f.properties.layerName) {
      case 'poi':
        return [255, 0, 0];
      case 'water':
        return [120, 150, 180];
      case 'building':
        return [218, 218, 218];
      default:
        return [240, 240, 240];
    }
  },

  getLineWidth: 1,
  lineWidthUnits: 'pixels',
  getLineColor: [192, 192, 192],

  getPointRadius: 4,
  pointRadiusUnits: 'pixels'
};

class Root extends PureComponent {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[
          showBasemap && createBasemap(),
          showMVT && createMVT(),
          showTile && createTile(),
          showPointCloud && createPointCloud()
        ]}
      />
    );
  }
}

function createMVT() {
  return new MVTLayer({
    ...MAP_LAYER_STYLES,
    data: MVT_URL,
    pickable: true,
    autoHighlight: true,
    binary: true
  });
}

function tileToBinary(tile) {
  const coordLength = 2;
  const il = tile.coords.length;
  const ids = new Uint16Array(tile.coords.length);
  for (let i = 0; i < il; i++) {
    ids[i] = coordLength * i;
  }
  const value = {
    points: {
      positions: {value: new Float32Array(tile.coords), size: coordLength},
      globalFeatureIds: {value: ids, size: 1},
      featureIds: {value: ids, size: 1},
      numericProps: {},
      properties: []
    },
    lines: {
      positions: {value: new Float32Array(), size: 2},
      pathIndices: {value: new Uint16Array(), size: 1},
      globalFeatureIds: {value: new Uint16Array(), size: 1},
      featureIds: {value: new Uint16Array(), size: 1},
      numericProps: {},
      properties: []
    },
    polygons: {
      positions: {value: new Float32Array(), size: 2},
      polygonIndices: {value: new Uint16Array(), size: 1},
      primitivePolygonIndices: {value: new Uint16Array(), size: 1},
      globalFeatureIds: {value: new Uint16Array(), size: 1},
      featureIds: {value: new Uint16Array(), size: 1},
      numericProps: {},
      properties: []
    }
  };

  return value;
}

function createTile() {
  return new TileLayer({
    data: ALBERTO ? ALBERTO_URL : ANTONIO_URL,
    autoHighlight: true,
    highlightColor: [60, 60, 60, 40],
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    zoomOffset: devicePixelRatio === 1 ? -1 : 0,
    getTileData: tile => {
      return fetch(tile.url)
        .then(response => response.arrayBuffer())
        .then(parsePbf);
    },
    renderSubLayers: props => {
      const {
        bbox: {west, south, east, north}
      } = props.tile;

      const binaryData = USE_BINARY
        ? tileToBinary(props.data)
        : geojsonToBinary(props.data.features);
      return [
        new GeoJsonLayer({
          id: `${props.id}-geojson`,
          data: binaryData,
          // Styles
          stroked: true,
          filled: true,
          pointType: 'circle',
          pointRadiusUnits: 'pixels',
          lineWidthMinPixels: 0.5,
          getPointRadius: 1.5,
          getLineColor: [0, 0, 200],
          getFillColor: ALBERTO ? [0, 0, 0] : [255, 50, 11]
        }),
        BORDERS &&
          new PathLayer({
            id: `${props.id}-border`,
            visible: true,
            data: [[[west, north], [west, south], [east, south], [east, north], [west, north]]],
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

function createScatterDefault() {
  return new ScatterplotLayer({
    id: 'scatter-plot',
    data: POINTS_URL,
    radiusScale: 30,
    radiusMinPixels: 0.25,
    getPosition: d => [d[0], d[1], 0],
    getFillColor: d => (d[2] === 1 ? [0, 128, 255] : [255, 0, 128]),
    getRadius: 1
  });
}

function parseJSON(response) {
  const value = response.json();
  return value;
}

function parsePbf(buffer) {
  const pbf = new Protobuf(buffer);
  const tile = Tile.read(pbf);
  return tile;
}

function createPointCloud() {
  return new PointCloudLayer({
    id: 'point-cloud',
    data: fetch(SINGLE_TILE_URL)
      .then(response => response.arrayBuffer())
      .then(parsePbf),
    pointSize: 6,
    getColor: [255, 0, 0],
    getRadius: 1
  });
}

render(<Root />, document.body.appendChild(document.createElement('div')));
