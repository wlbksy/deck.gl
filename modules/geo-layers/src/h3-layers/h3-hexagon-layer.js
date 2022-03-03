import {
  h3ToGeoBoundary,
  h3GetResolution,
  h3ToGeo,
  geoToH3,
  h3IsPentagon,
  h3Distance,
  edgeLength,
  UNITS
} from 'h3-js';
import {lerp} from '@math.gl/core';
import {CompositeLayer, createIterable} from '@deck.gl/core';
import {ColumnLayer, PolygonLayer} from '@deck.gl/layers';

// There is a cost to updating the instanced geometries when using highPrecision: false
// This constant defines the distance between two hexagons that leads to "significant
// distortion." Smaller value makes the column layer more sensitive to viewport change.
const UPDATE_THRESHOLD_KM = 10;

const h3_face_5_lat = 9.897578191520505;
const h3_face_5_lng = 96.15073392959359;

const h3_face_5_lat_rad = deg2rad(h3_face_5_lat);
const h3_face_5_lng_rad = deg2rad(h3_face_5_lng);

const M_EYE = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

let R_h3_to_amap = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];
const R_amap_to_h3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

function deg2rad(d) {
  return (d / 180) * Math.PI;
}

function rad2deg(r) {
  return (r * 180) / Math.PI;
}

function matrix_mul_vector(m, v) {
  const res = [0, 0, 0];
  for (let i = 0; i < 3; ++i) {
    let t = 0;
    for (let j = 0; j < 3; ++j) {
      t += m[i][j] * v[j];
    }
    res[i] = t;
  }
  return res;
}

function matrix_mul_matrix(a, b) {
  const res = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; ++i) {
    for (let k = 0; k < 3; ++k) {
      let t = 0;
      for (let j = 0; j < 3; ++j) {
        t += a[i][j] * b[j][k];
        res[i][k] = t;
      }
    }
  }
  return res;
}

function scale_matrix(s, m) {
  const res = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
      res[i][j] = s * m[i][j];
    }
  }
  return res;
}

function matrix_add_matrix(a, b) {
  const res = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
      res[i][j] = a[i][j] + b[i][j];
    }
  }
  return res;
}

function latlngToXyz(p) {
  // p: [lat, lng]
  const lat_rad = deg2rad(p[0]);
  const lng_rad = deg2rad(p[1]);

  const r = Math.cos(lat_rad);
  const z = Math.sin(lat_rad);
  const x = Math.cos(lng_rad) * r;
  const y = Math.sin(lng_rad) * r;
  return [x, y, z];
}

function xyzToLatlng(p) {
  const lat_rad = Math.asin(p[2]);
  const lng_rad = Math.atan2(p[1], p[0]);

  const lat = rad2deg(lat_rad);
  const lng = rad2deg(lng_rad);

  return [lat, lng];
}

function rotate_point(p, m) {
  const h3_xyz = latlngToXyz(p);
  const amap_xyz = matrix_mul_vector(m, h3_xyz);
  return xyzToLatlng(amap_xyz);
}

function amapGeoToH3Geo(p) {
  return rotate_point(p, R_amap_to_h3);
}
function h3GeoToAmapGeo(p) {
  return rotate_point(p, R_h3_to_amap);
}

function reverse_geo(p) {
  return [p[1], p[0]];
}

function idToPolygonRotated(hexId) {
  const origin_vertices = h3ToGeoBoundary(hexId, true);
  return origin_vertices.map(reverse_geo).map(h3GeoToAmapGeo).map(reverse_geo);
}

function idToCenterRotated(hexId) {
  const p = h3ToGeo(hexId);
  return h3GeoToAmapGeo(p);
}

function centerToIdRotated(lat, lng, resolution) {
  const p = amapGeoToH3Geo([lat, lng]);
  return geoToH3(p[0], p[1], resolution);
}

function skew(geolatlng) {
  const [x, y, z] = latlngToXyz(geolatlng);
  return [
    [0, -z, y],
    [z, 0, -x],
    [-y, x, 0]
  ];
}

function rotation_axis_angle(g, r) {
  const K = skew(g);
  const s = Math.sin(r);
  const c = Math.cos(r);

  const m1 = scale_matrix(s, K);
  const m2 = matrix_mul_matrix(K, K);
  const m3 = scale_matrix(1 - c, m2);
  const m4 = matrix_add_matrix(m1, m3);
  const m5 = matrix_add_matrix(M_EYE, m4);

  return m5;
}

function rotation3D_x(r) {
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [1.0, 0.0, 0.0],
    [0.0, c, -s],
    [0.0, s, c]
  ];
}

function rotation3D_z(r) {
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [c, -s, 0.0],
    [s, c, 0.0],
    [0.0, 0.0, 1.0]
  ];
}

function reset_by_centroid_and_azimuth(centroid_lat, centroid_lng, azimuth) {
  const centroid_lat_rad = deg2rad(centroid_lat);
  const centroid_lng_rad = deg2rad(centroid_lng);

  const x_angle = centroid_lat_rad - h3_face_5_lat_rad;
  const z_angle = centroid_lng_rad - h3_face_5_lng_rad;

  const m1 = rotation_axis_angle([centroid_lat, centroid_lng], deg2rad(azimuth));
  const m2 = rotation3D_z(z_angle);
  const m3 = rotation3D_x(x_angle);

  const m4 = matrix_mul_matrix(m1, m2);
  const R = matrix_mul_matrix(m4, m3);

  R_h3_to_amap = R;
  for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
      R_amap_to_h3[i][j] = R[j][i];
    }
  }
}

// normalize longitudes w.r.t center (refLng), when not provided first vertex
export function normalizeLongitudes(vertices, refLng) {
  refLng = refLng === undefined ? vertices[0][0] : refLng;
  for (const pt of vertices) {
    const deltaLng = pt[0] - refLng;
    if (deltaLng > 180) {
      pt[0] -= 360;
    } else if (deltaLng < -180) {
      pt[0] += 360;
    }
  }
}

// scale polygon vertices w.r.t center (hexId)
export function scalePolygon(hexId, vertices, factor) {
  const [lat, lng] = idToCenterRotated(hexId);
  const actualCount = vertices.length;

  // normalize with respect to center
  normalizeLongitudes(vertices, lng);

  // `h3ToGeoBoundary` returns same array object for first and last vertex (closed polygon),
  // if so skip scaling the last vertex
  const vertexCount = vertices[0] === vertices[actualCount - 1] ? actualCount - 1 : actualCount;
  for (let i = 0; i < vertexCount; i++) {
    vertices[i][0] = lerp(lng, vertices[i][0], factor);
    vertices[i][1] = lerp(lat, vertices[i][1], factor);
  }
}

function getHexagonCentroid(getHexagon, object, objectInfo) {
  const hexagonId = getHexagon(object, objectInfo);
  const [lat, lng] = idToCenterRotated(hexagonId);
  return [lng, lat];
}

function h3ToPolygon(hexId, coverage = 1, flatten) {
  const vertices = idToPolygonRotated(hexId);

  if (coverage !== 1) {
    // scale and normalize vertices w.r.t to center
    scalePolygon(hexId, vertices, coverage);
  } else {
    // normalize w.r.t to start vertex
    normalizeLongitudes(vertices);
  }

  if (flatten) {
    const positions = new Float64Array(vertices.length * 2);
    let i = 0;
    for (const pt of vertices) {
      positions[i++] = pt[0];
      positions[i++] = pt[1];
    }
    return positions;
  }

  return vertices;
}

function mergeTriggers(getHexagon, coverage) {
  let trigger;
  if (getHexagon === undefined || getHexagon === null) {
    trigger = coverage;
  } else if (typeof getHexagon === 'object') {
    trigger = {...getHexagon, coverage};
  } else {
    trigger = {getHexagon, coverage};
  }
  return trigger;
}

const defaultProps = {
  ...PolygonLayer.defaultProps,
  highPrecision: 'auto',
  coverage: {type: 'number', min: 0, max: 1, value: 1},
  centerHexagon: null,
  getHexagon: {type: 'accessor', value: x => x.hexagon},
  extruded: true
};

// not supported
delete defaultProps.getLineDashArray;

/**
 * A subclass of HexagonLayer that uses H3 hexagonIds in data objects
 * rather than centroid lat/longs. The shape of each hexagon is determined
 * based on a single "center" hexagon, which can be selected by passing in
 * a center lat/lon pair. If not provided, the map center will be used.
 *
 * Also sets the `hexagonId` field in the onHover/onClick callback's info
 * objects. Since this is calculated using math, hexagonId will be present
 * even when no corresponding hexagon is in the data set. You can check
 * index !== -1 to see if picking matches an actual object.
 */
export default class H3HexagonLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return this._shouldUseHighPrecision()
      ? changeFlags.propsOrDataChanged
      : changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    if (
      props.highPrecision !== true &&
      (changeFlags.dataChanged ||
        (changeFlags.updateTriggers && changeFlags.updateTriggers.getHexagon))
    ) {
      const dataProps = this._calculateH3DataProps(props);
      this.setState(dataProps);
    }

    this._updateVertices(this.context.viewport);
  }

  _calculateH3DataProps(props) {
    let resolution = -1;
    let hasPentagon = false;
    let hasMultipleRes = false;

    const {iterable, objectInfo} = createIterable(props.data);
    for (const object of iterable) {
      objectInfo.index++;
      const hexId = props.getHexagon(object, objectInfo);
      // Take the resolution of the first hex
      const hexResolution = h3GetResolution(hexId);
      if (resolution < 0) {
        resolution = hexResolution;
        if (!props.highPrecision) break;
      } else if (resolution !== hexResolution) {
        hasMultipleRes = true;
        break;
      }
      if (h3IsPentagon(hexId)) {
        hasPentagon = true;
        break;
      }
    }

    return {
      resolution,
      edgeLengthKM: resolution >= 0 ? edgeLength(resolution, UNITS.km) : 0,
      hasMultipleRes,
      hasPentagon
    };
  }

  _shouldUseHighPrecision() {
    if (this.props.highPrecision === 'auto') {
      const {resolution, hasPentagon, hasMultipleRes} = this.state;
      const {viewport} = this.context;
      return (
        viewport.resolution || hasMultipleRes || hasPentagon || (resolution >= 0 && resolution <= 5)
      );
    }

    return this.props.highPrecision;
  }

  _updateVertices(viewport) {
    if (this._shouldUseHighPrecision()) {
      return;
    }
    const {resolution, edgeLengthKM, centerHex} = this.state;
    if (resolution < 0) {
      return;
    }
    const hex =
      this.props.centerHexagon ||
      centerToIdRotated(viewport.latitude, viewport.longitude, resolution);
    if (centerHex === hex) {
      return;
    }
    if (centerHex) {
      const distance = h3Distance(centerHex, hex);
      // h3Distance returns a negative number if the distance could not be computed
      // due to the two indexes very far apart or on opposite sides of a pentagon.
      if (distance >= 0 && distance * edgeLengthKM < UPDATE_THRESHOLD_KM) {
        return;
      }
    }

    const {unitsPerMeter} = viewport.distanceScales;

    let vertices = h3ToPolygon(hex);
    const [centerLat, centerLng] = idToCenterRotated(hex);

    const [centerX, centerY] = viewport.projectFlat([centerLng, centerLat]);
    vertices = vertices.map(p => {
      const worldPosition = viewport.projectFlat(p);
      return [
        (worldPosition[0] - centerX) / unitsPerMeter[0],
        (worldPosition[1] - centerY) / unitsPerMeter[1]
      ];
    });

    this.setState({centerHex: hex, vertices});
  }

  renderLayers() {
    reset_by_centroid_and_azimuth(32.1285602329, 114.0831041336, 30);
    return this._shouldUseHighPrecision() ? this._renderPolygonLayer() : this._renderColumnLayer();
  }

  _getForwardProps() {
    const {
      elevationScale,
      material,
      coverage,
      extruded,
      wireframe,
      stroked,
      filled,
      lineWidthUnits,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      getFillColor,
      getElevation,
      getLineColor,
      getLineWidth,
      transitions,
      updateTriggers
    } = this.props;

    return {
      elevationScale,
      extruded,
      coverage,
      wireframe,
      stroked,
      filled,
      lineWidthUnits,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      material,
      getElevation,
      getFillColor,
      getLineColor,
      getLineWidth,
      transitions,
      updateTriggers: {
        getFillColor: updateTriggers.getFillColor,
        getElevation: updateTriggers.getElevation,
        getLineColor: updateTriggers.getLineColor,
        getLineWidth: updateTriggers.getLineWidth
      }
    };
  }

  _renderPolygonLayer() {
    const {data, getHexagon, updateTriggers, coverage} = this.props;

    const SubLayerClass = this.getSubLayerClass('hexagon-cell-hifi', PolygonLayer);
    const forwardProps = this._getForwardProps();

    forwardProps.updateTriggers.getPolygon = mergeTriggers(updateTriggers.getHexagon, coverage);

    return new SubLayerClass(
      forwardProps,
      this.getSubLayerProps({
        id: 'hexagon-cell-hifi',
        updateTriggers: forwardProps.updateTriggers
      }),
      {
        data,
        _normalize: false,
        _windingOrder: 'CCW',
        positionFormat: 'XY',
        getPolygon: (object, objectInfo) => {
          const hexagonId = getHexagon(object, objectInfo);
          return h3ToPolygon(hexagonId, coverage, true);
        }
      }
    );
  }

  _renderColumnLayer() {
    const {data, getHexagon, updateTriggers} = this.props;

    const SubLayerClass = this.getSubLayerClass('hexagon-cell', ColumnLayer);
    const forwardProps = this._getForwardProps();
    forwardProps.updateTriggers.getPosition = updateTriggers.getHexagon;

    return new SubLayerClass(
      forwardProps,
      this.getSubLayerProps({
        id: 'hexagon-cell',
        flatShading: true,
        updateTriggers: forwardProps.updateTriggers
      }),
      {
        data,
        diskResolution: 6, // generate an extruded hexagon as the base geometry
        radius: 1,
        vertices: this.state.vertices,
        getPosition: getHexagonCentroid.bind(null, getHexagon)
      }
    );
  }
}

H3HexagonLayer.defaultProps = defaultProps;
H3HexagonLayer.layerName = 'H3HexagonLayer';
