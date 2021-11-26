/* global devicePixelRatio, document, fetch, performance */
/* eslint-disable no-console */
import React, {PureComponent} from 'react';
import {render} from 'react-dom';
import Tile from './CVT';
import Protobuf from 'pbf';
import DeckGL from '@deck.gl/react';
import {MVTLayer, TileLayer} from '@deck.gl/geo-layers';
import {GeoJsonLayer, PathLayer, PointCloudLayer} from '@deck.gl/layers';
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

// Hack static URL for now
const GEOJSON_URL =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson';

const params = new URLSearchParams(location.search.slice(1));
const apiBaseUrl = 'https://gcp-us-east1-19.dev.api.carto.com';
const connection = params.get('connection') || 'bigquery';
const table = params.get('table') || 'cartobq.testtables.points_100k';
const format = 'tilejson'; //
const formatTiles = params.get('formatTiles') || 'geojson'; // mvt | geojson | binary
const geomType = params.get('geomType') || 'points'; // points | lines | polygons
const token =
  'eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfZmt0MXdsbCIsImp0aSI6IjNmM2NlMjA3In0.zzfm2xZSAjcTlLxaPQHDy8uVJbGtEC5gItOg8U_gfP4';

const URL = `${apiBaseUrl}/v3/maps/${connection}/table/{z}/{x}/{y}?name=${table}&cache=&access_token=${token}&formatTiles=${formatTiles}&geomType=${geomType}`;

const USE_BINARY = false;

const showBasemap = true;
const showTile = true;
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
        layers={[showBasemap && createBasemap(), showTile && createTile()]}
      />
    );
  }
}

// Fake out indices
function generateIndices(positions) {
  const n = positions.value.length / positions.size;
  const ids = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    ids[i] = i;
  }
  return {value: ids, size: 1};
}

function tileToBinary(tile) {
  // Convert to typed arrays
  // POINT
  tile.points.positions.value = new Float32Array(tile.points.positions.value);
  tile.points.featureIds = generateIndices(tile.points.positions);
  tile.points.globalFeatureIds = tile.points.featureIds;

  // LINE
  tile.lines.positions.value = new Float32Array(tile.lines.positions.value);
  tile.lines.pathIndices.value = new Uint16Array(tile.lines.pathIndices.value);
  tile.lines.featureIds = generateIndices(tile.lines.positions);
  tile.lines.globalFeatureIds = tile.lines.featureIds;

  // POLYGON
  tile.polygons.positions.value = new Float32Array(tile.polygons.positions.value);
  tile.polygons.polygonIndices.value = new Uint16Array(tile.polygons.polygonIndices.value);
  // TODO don't copy!
  tile.polygons.primitivePolygonIndices = tile.polygons.polygonIndices;
  tile.polygons.featureIds = generateIndices(tile.polygons.positions);
  tile.polygons.globalFeatureIds = tile.polygons.featureIds;

  const value = {
    points: {
      ...tile.points,
      numericProps: {},
      properties: [],
      type: 'Point'
    },
    lines: {
      ...tile.lines,
      numericProps: {},
      properties: [],
      type: 'LineString'
    },
    polygons: {
      ...tile.polygons,
      numericProps: {},
      properties: [],
      type: 'Polygon'
    }
  };

  return value;
}

const EMPTY_FEATURECOLLECTION = {
  type: 'FeatureCollection',
  features: []
};

function createTile() {
  return new TileLayer({
    data: URL,
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
            } else if (response.status === 401) {
              // Hack to work around lack of token for now
              return EMPTY_FEATURECOLLECTION;
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
          getFillColor: [255, 50, 11]
        }),
        BORDERS &&
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

render(<Root />, document.body.appendChild(document.createElement('div')));
