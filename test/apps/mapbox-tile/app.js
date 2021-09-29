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

const TEST_TILES_URL =
  'http://10.0.32.237:8002/v3/maps/bigquery/table/{z}/{x}/{y}?mapId=cartodb-gcp-backend-data-team._d296517907c39746c3a5652253a82ad3ee035be5.anon3c8918185b69854ef19bcfcd5afc498070e2dfbc&format=geojson&access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJYVnRIYUdzaTUxMFZZYml1YjA5ZCJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImFsYmVydG9AY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfbWs3bXV6Z3UiLCJpc3MiOiJodHRwczovL2F1dGgubG9jYWwuY2FydG8uY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA4NDA5NTYzMzQxMzU5MDQxNjg0IiwiYXVkIjoiY2FydG8tY2xvdWQtbmF0aXZlLWFwaSIsImlhdCI6MTYzMjkxMjIzNCwiZXhwIjoxNjMyOTk4NjM0LCJhenAiOiJGM2tKOVJoUWhFTUFodDFRQllkQUluckRRTXJKVlI4dSIsInNjb3BlIjoicmVhZDpjdXJyZW50X3VzZXIiLCJwZXJtaXNzaW9ucyI6WyJhZG1pbjphY2NvdW50IiwicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInVwZGF0ZTpjdXJyZW50X3VzZXIiLCJ3cml0ZTphcHBzIiwid3JpdGU6Y29ubmVjdGlvbnMiLCJ3cml0ZTppbXBvcnRzIiwid3JpdGU6bGlzdGVkX2FwcHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIl19.SPs4WJHjwa8X8Nz8-4noZU2xQmZ8N52XZh3Gmea18-aCBQBUh9BML8WcpBYDD_LU9a02V2uG8Xp4otnkz-C1gA7idMmynthQAYSeRQWslImbjR5BwYW7l6XMTJ3fF2a2MRC6gQCtgfN45OYagvzNNBcQEn6Fffcs79BUkQsdhRctFp5AN1SU7ixevly24_BJM56vX0ihCstFhaoQiDQCX7R7MHNLFIk1RXb2xDC-3inhUzw94wetPHcQNBr5MiLQfNmJYVq_oemU7bVGsT2iIvZIghhypBy__eA_z0uwtiEAekC_01JQ-9v1_TjewmLs30qzyfNonKX32nVcjKiJuw';

const showBasemap = true;
const showMVT = false;
const showTile = true;
const showPointCloud = true;
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

function createTile() {
  return new TileLayer({
    data: TEST_TILES_URL,
    autoHighlight: true,
    highlightColor: [60, 60, 60, 40],
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    zoomOffset: devicePixelRatio === 1 ? -1 : 0,
    renderSubLayers: props => {
      const {
        bbox: {west, south, east, north}
      } = props.tile;

      const geojsonData = props.data;
      const binaryData = geojsonToBinary(geojsonData.features);
      return [
        new GeoJsonLayer({
          id: `${props.id}-geojson`,
          data: binaryData,
          // Styles
          stroked: true,
          filled: true,
          pointType: 'circle',
          pointRadiusUnits: 'pixels',
          lineWidthMinPixels: 3,
          getPointRadius: 10,
          getLineColor: [0, 0, 200],
          getFillColor: [12, 50, 238]
        }),
        BORDERS &&
          new PathLayer({
            id: `${props.id}-border`,
            visible: true,
            data: [[[west, north], [west, south], [east, south], [east, north], [west, north]]],
            getPath: d => d,
            getColor: [255, 0, 0, 20],
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
  const coords = tile.coords;
  const value = {
    length: coords.length / 2,
    attributes: {
      getPosition: {value: new Float32Array(coords), size: 2}
    }
  };
  return value;
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
