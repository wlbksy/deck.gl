/* global devicePixelRatio, document, fetch, performance */
/* eslint-disable no-console */
import React, {PureComponent} from 'react';
import {render} from 'react-dom';
import Tile from './Polygons';
import Protobuf from 'pbf';
import DeckGL from '@deck.gl/react';
import {MVTLayer, TileLayer} from '@deck.gl/geo-layers';
import {GeoJsonLayer, PathLayer, PointCloudLayer, ScatterplotLayer} from '@deck.gl/layers';
import {binaryToGeojson, geojsonToBinary} from '@loaders.gl/gis';

// Set your mapbox token here
const MAPBOX_TOKEN = process.env.MapboxAccessToken; // eslint-disable-line

const INITIAL_VIEW_STATE = {
  bearing: 0,
  pitch: 0,
  longitude: -73.95643,
  latitude: 40.8039,
  zoom: 9
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

const ALBERTO = true;
const ALBERTO_URL =
  'http://10.0.32.237:8002/v3/maps/bq-bi-engine/table/{z}/{x}/{y}?mapId=cartobq._d296517907c39746c3a5652253a82ad3ee035be5.anon3c8918185b69854ef19bcfcd5afc498070e2dfbc&format=geojson&access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJYVnRIYUdzaTUxMFZZYml1YjA5ZCJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImFsYmVydG9AY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfbWs3bXV6Z3UiLCJpc3MiOiJodHRwczovL2F1dGgubG9jYWwuY2FydG8uY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA4NDA5NTYzMzQxMzU5MDQxNjg0IiwiYXVkIjoiY2FydG8tY2xvdWQtbmF0aXZlLWFwaSIsImlhdCI6MTYzMjkxMjIzNCwiZXhwIjoxNjMyOTk4NjM0LCJhenAiOiJGM2tKOVJoUWhFTUFodDFRQllkQUluckRRTXJKVlI4dSIsInNjb3BlIjoicmVhZDpjdXJyZW50X3VzZXIiLCJwZXJtaXNzaW9ucyI6WyJhZG1pbjphY2NvdW50IiwicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInVwZGF0ZTpjdXJyZW50X3VzZXIiLCJ3cml0ZTphcHBzIiwid3JpdGU6Y29ubmVjdGlvbnMiLCJ3cml0ZTppbXBvcnRzIiwid3JpdGU6bGlzdGVkX2FwcHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIl19.SPs4WJHjwa8X8Nz8-4noZU2xQmZ8N52XZh3Gmea18-aCBQBUh9BML8WcpBYDD_LU9a02V2uG8Xp4otnkz-C1gA7idMmynthQAYSeRQWslImbjR5BwYW7l6XMTJ3fF2a2MRC6gQCtgfN45OYagvzNNBcQEn6Fffcs79BUkQsdhRctFp5AN1SU7ixevly24_BJM56vX0ihCstFhaoQiDQCX7R7MHNLFIk1RXb2xDC-3inhUzw94wetPHcQNBr5MiLQfNmJYVq_oemU7bVGsT2iIvZIghhypBy__eA_z0uwtiEAekC_01JQ-9v1_TjewmLs30qzyfNonKX32nVcjKiJuw';

const USE_BINARY = false;
const table = 'cartobq.testtables.polygons_10k';
const format = USE_BINARY ? 'cvt' : 'geojson';
const geomType = 'polygons';
const ALBERTO_URL2 = `http://192.168.201.233:8002/v3/maps/bq-bi-engine/table/{z}/{x}/{y}?format=${format}&geomType=${geomType}&name=${table}&access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJYVnRIYUdzaTUxMFZZYml1YjA5ZCJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImFsYmVydG9AY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfbWs3bXV6Z3UiLCJpc3MiOiJodHRwczovL2F1dGgubG9jYWwuY2FydG8uY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA4NDA5NTYzMzQxMzU5MDQxNjg0IiwiYXVkIjoiY2FydG8tY2xvdWQtbmF0aXZlLWFwaSIsImlhdCI6MTYzMzAwMjg4NCwiZXhwIjoxNjMzMDg5Mjg0LCJhenAiOiJGM2tKOVJoUWhFTUFodDFRQllkQUluckRRTXJKVlI4dSIsInNjb3BlIjoicmVhZDpjdXJyZW50X3VzZXIiLCJwZXJtaXNzaW9ucyI6WyJhZG1pbjphY2NvdW50IiwicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInVwZGF0ZTpjdXJyZW50X3VzZXIiLCJ3cml0ZTphcHBzIiwid3JpdGU6Y29ubmVjdGlvbnMiLCJ3cml0ZTppbXBvcnRzIiwid3JpdGU6bGlzdGVkX2FwcHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIl19.ADe3FzhaqNcNAXmOgb4dvhXfOv27V2hVPAp2EXWdIuwBpEnanc8OhbTka4SmTXSVtTjyrOE0HECRRfpSi0_TeM9fXkHfIRM0MO5e_gUd0xN1-3I6_3dZadJFihquFQIqPECp9VzYMHD5N9k3z9uIscD4tFI7CmveQqvqFzFOMeKQ4uprSY3z3uTh3q5Nflk0_4sQ2kDKwaURdUsPKg0OqoJoUzKoA_vVD1JH82KX-R4LYWPlcMAjyTGIFHd8aO4nUiv6TASH_DNXhcHcMCYX6d4YgEQSnCtaoBUMS9xkOoM-LumWer0kAF8-5VsFpZmDZTCivFwjZS7IX5s7fkPyPQ`;

const tests = [10, 100, 250, 500];
const featureCount = tests[Math.floor((100000 * Math.random()) % tests.length)];
const binary = Math.random() > 0.5;
const ANTONIO_GEOJSON_URL = `http://192.168.201.20:8002/v3/maps/dev-bigquery/table?name=cartobq.testtables.polygons_${featureCount}k&format=geojson&access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJYVnRIYUdzaTUxMFZZYml1YjA5ZCJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImFjb3J0ZXNAY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfZGEwdmpmZyIsImlzcyI6Imh0dHBzOi8vYXV0aC5sb2NhbC5jYXJ0by5jb20vIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMDMyMzk1MzA1MDY5OTQ5NTM3NzUiLCJhdWQiOiJjYXJ0by1jbG91ZC1uYXRpdmUtYXBpIiwiaWF0IjoxNjMzMDExODg4LCJleHAiOjE2MzMwOTgyODgsImF6cCI6IkYza0o5UmhRaEVNQWh0MVFCWWRBSW5yRFFNckpWUjh1Iiwic2NvcGUiOiJyZWFkOmN1cnJlbnRfdXNlciIsInBlcm1pc3Npb25zIjpbImFkbWluOmFjY291bnQiLCJyZWFkOmFjY291bnQiLCJyZWFkOmFwcHMiLCJyZWFkOmNvbm5lY3Rpb25zIiwicmVhZDpjdXJyZW50X3VzZXIiLCJyZWFkOmltcG9ydHMiLCJyZWFkOmxpc3RlZF9hcHBzIiwicmVhZDptYXBzIiwicmVhZDp0aWxlc2V0cyIsInJlYWQ6dG9rZW5zIiwidXBkYXRlOmN1cnJlbnRfdXNlciIsIndyaXRlOmFwcHMiLCJ3cml0ZTpjb25uZWN0aW9ucyIsIndyaXRlOmltcG9ydHMiLCJ3cml0ZTpsaXN0ZWRfYXBwcyIsIndyaXRlOm1hcHMiLCJ3cml0ZTp0b2tlbnMiXX0.lPOSAOqhjH4cjjy0E1jfRyZ8SnQ-axvt9YBkCVoxU6YsR-N4lcCFFU82Qy1bVJbRlukjSdEEmtGJwTEWrUTjiWGBWZPKQrMh5aGLa56k-c-qe4mZpmijnuxbPNzMQHXiob-h2L2i47a62Udnio5f6zp88cnb3NIoR_QpkhSlx3lEaatUUUjG6s7EgF6Ay6jAcmryGgEktrY1qShB7BoM7_-xQ71RU7zqcCk7puwWCG1Nz-WoQeWnRBjVvYyFR69DpqYVBrFMO-S0QlbaO1nfVi_lPvzd5t2thWOP7QNz9AFUhgBAN4N5BSnXZ1UoSUWIzJOG3dccrbyCke9RZLhoWg`;
const ANTONIO_URL =
  'http://192.168.201.20:8002/v3/maps/dev-bigquery/table/{z}/{x}/{y}?mapId=cartodb-gcp-backend-data-team._d296517907c39746c3a5652253a82ad3ee035be5.anon3c8918185b69854ef19bcfcd5afc498070e2dfbc&format=geojson&access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJYVnRIYUdzaTUxMFZZYml1YjA5ZCJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImFjb3J0ZXNAY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfZGEwdmpmZyIsImlzcyI6Imh0dHBzOi8vYXV0aC5sb2NhbC5jYXJ0by5jb20vIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMDMyMzk1MzA1MDY5OTQ5NTM3NzUiLCJhdWQiOiJjYXJ0by1jbG91ZC1uYXRpdmUtYXBpIiwiaWF0IjoxNjMyOTI0OTM4LCJleHAiOjE2MzMwMTEzMzgsImF6cCI6IkYza0o5UmhRaEVNQWh0MVFCWWRBSW5yRFFNckpWUjh1Iiwic2NvcGUiOiJyZWFkOmN1cnJlbnRfdXNlciIsInBlcm1pc3Npb25zIjpbImFkbWluOmFjY291bnQiLCJyZWFkOmFjY291bnQiLCJyZWFkOmFwcHMiLCJyZWFkOmNvbm5lY3Rpb25zIiwicmVhZDpjdXJyZW50X3VzZXIiLCJyZWFkOmltcG9ydHMiLCJyZWFkOmxpc3RlZF9hcHBzIiwicmVhZDptYXBzIiwicmVhZDp0aWxlc2V0cyIsInJlYWQ6dG9rZW5zIiwidXBkYXRlOmN1cnJlbnRfdXNlciIsIndyaXRlOmFwcHMiLCJ3cml0ZTpjb25uZWN0aW9ucyIsIndyaXRlOmltcG9ydHMiLCJ3cml0ZTpsaXN0ZWRfYXBwcyIsIndyaXRlOm1hcHMiLCJ3cml0ZTp0b2tlbnMiXX0.RhMht6LutV9NjEvgfyVvLMN-avUvJYowLyozMSGbjyZe59JRzd51Fv5U3W45qHIXQhMv8wj86sTDX6zsH0uMy3NOg6UsTClqwKIRNutkmQqTkNA2gJ1Qk6Dkc_Yj08RsW6jTyQhBZVTw5T6wZutmm3LcLlLHb9dMX0TrfRwblD3f-YHMxF8UVL-O8WUV9VI3rE5cwmYeP1qbGNrVkxjG3pquHXzTo_b8CrDVGbbGlVyh9M30YAYjC0rHGaPWaCqEtu6eRJPvClHqbD5qQQinCEMzS4PDh5_pyMtC1XX3gclV1mb4rlnWE7YWoywyEp4szy1__fz8tRXQp0K32VS6Ng';

const showBasemap = true;
const showGeoJson = false;
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
        onAfterRender={onAfterRender}
        layers={[
          showBasemap && createBasemap(),
          showGeoJson && createGeoJson(),
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

const coordLength = 2;
function generatePointIndices(coords) {
  const n = coords.length / coordLength;
  const ids = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    ids[i] = coordLength * i;
  }
  return ids;
}

function tileToBinary(tile) {
  const pointPositions = (tile && tile.coords) || [];
  const ids = generatePointIndices(pointPositions);
  const linesPositions = (tile && tile.positions) || [];
  let linesPathIndices = (tile && tile.pathIndices) || [];

  const linesIds = [...linesPathIndices];
  if (linesPathIndices.length > 0) {
    // Correct index to be per-vertex
    linesPathIndices = linesPathIndices.map(i => i / 2);

    // Add in final vertex
    linesPathIndices.push(linesPositions.length / 2);
  }
  const value = {
    points: {
      positions: {value: new Float32Array(pointPositions), size: coordLength},
      globalFeatureIds: {value: ids, size: 1},
      featureIds: {value: ids, size: 1},
      numericProps: {},
      properties: [],
      type: 'Point'
    },
    lines: {
      positions: {value: new Float32Array(linesPositions), size: 2},
      pathIndices: {value: new Uint16Array(linesPathIndices), size: 1},
      globalFeatureIds: {value: new Uint16Array(linesIds), size: 1},
      featureIds: {value: new Uint16Array(linesIds), size: 1},
      numericProps: {},
      properties: [],
      type: 'LineString'
    },
    polygons: {
      positions: {value: new Float32Array(), size: 2},
      polygonIndices: {value: new Uint16Array(), size: 1},
      primitivePolygonIndices: {value: new Uint16Array(), size: 1},
      globalFeatureIds: {value: new Uint16Array(), size: 1},
      featureIds: {value: new Uint16Array(), size: 1},
      numericProps: {},
      properties: [],
      type: 'Polygon'
    }
  };

  return value;
}

function createTile() {
  return new TileLayer({
    data: ALBERTO ? ALBERTO_URL2 : ANTONIO_URL,
    autoHighlight: true,
    highlightColor: [60, 60, 60, 40],
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    zoomOffset: devicePixelRatio === 1 ? -1 : 0,
    getTileData: tile => {
      return USE_BINARY
        ? fetch(tile.url)
            .then(response => {
              if (response.status === 204) {
                return null;
              }
              return response.arrayBuffer();
            })
            .then(parsePbf)
        : fetch(tile.url).then(response => {
            if (response.status === 204) {
              return null;
            }
            return response.json();
          });
    },
    renderSubLayers: props => {
      if (props.data === null) {
        return null;
      }
      const {
        bbox: {west, south, east, north}
      } = props.tile;

      const binaryData = USE_BINARY
        ? tileToBinary(props.data)
        : geojsonToBinary(props.data.features);
      //const geojson = binaryToGeojson(binaryData);
      return [
        new GeoJsonLayer({
          id: `${props.id}-geojson`,
          data: binaryData,
          // Styles
          stroked: true,
          filled: true,
          pointType: 'circle',
          // iconAtlas: './spider-apple.png',
          // iconMapping: {
          //   marker: {x: 0, y: 0, width: 160, height: 160, mask: true}
          // },
          // getIcon: d => 'marker',
          // getIconSize: 8,
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

let startTime;
let geoJsonLayer;
function onAfterRender() {
  if (geoJsonLayer && geoJsonLayer.isLoaded) {
    const delta = performance.now() - startTime;
    geoJsonLayer = null;
    console.log(`n: ${featureCount}, binary: ${binary}`, delta);

    const key = `${featureCount}-${binary ? 'binary' : 'geojson'}`;
    const keyCount = `${key}-count`;
    const average = parseFloat(localStorage.getItem(key)) || 0;
    const n = parseFloat(localStorage.getItem(keyCount)) || 0;
    const updated = (average * n + delta) / (n + 1);
    localStorage.setItem(key, updated);
    localStorage.setItem(keyCount, n + 1);
    setTimeout(() => {
      //window.location.reload();
    }, 3000);
  }
}

function createGeoJson() {
  geoJsonLayer = new GeoJsonLayer({
    id: 'geojson',
    data: fetch(ANTONIO_GEOJSON_URL)
      .then(response => response.json())
      .then(data => {
        data.features = data.features.filter(f => f.geometry.type !== 'GeometryCollection');
        if (binary) {
          data = geojsonToBinary(data.features);
        }
        startTime = performance.now();
        return data;
      }),
    // Styles
    stroked: true,
    filled: true,
    lineWidthMinPixels: 2,
    opacity: 0.4,
    getLineColor: [60, 60, 60],
    getFillColor: binary ? [0, 255, 0] : [200, 0, 0]
  });

  return geoJsonLayer;
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
  if (buffer === null) {
    return null;
  }
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
