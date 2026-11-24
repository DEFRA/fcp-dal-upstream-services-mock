#!/usr/bin/env node
// Generates synthetic land parcel geometries (British National Grid, EPSG:27700)
// and writes them to src/factories/valid-geometries.json.
//
// The parcels are made up: each is a field-like shape (4-7 corners with slightly
// wobbly edges) scattered around rural areas of England. Areas and vertex counts
// follow the same distribution as the real parcels the file used to hold
// (median ~18,500m², median ~70 vertices), so payload sizes stay similar.
//
// Output is deterministic for a given SEED and faker version. Usage: node scripts/generate-geometries.js
//
// Written with Claude Code (Claude Opus 5.5, Anthropic).

import fs from 'node:fs'
import { faker } from '@faker-js/faker'

const SEED = 27700
const COUNT = 327
const HOLE_PROBABILITY = 0.03
const MULTIPOLYGON_INDEX = 163
const SCATTER_METRES = 6000

// Rough centres of rural areas in England (BNG eastings/northings)
const ANCHORS = [
  [280000, 110000], // mid Devon
  [370000, 100000], // Dorset
  [340000, 135000], // Somerset Levels
  [400000, 150000], // Wiltshire
  [400000, 215000], // Cotswolds
  [350000, 240000], // Herefordshire
  [350000, 300000], // Shropshire
  [360000, 365000], // Cheshire
  [470000, 310000], // Leicestershire
  [540000, 280000], // Cambridgeshire
  [610000, 260000], // Suffolk
  [600000, 310000], // Norfolk
  [510000, 370000], // Lincolnshire
  [490000, 460000], // Yorkshire Wolds
  [440000, 470000], // North Yorkshire
  [350000, 440000], // Lancashire
  [360000, 530000], // Eden Valley
  [400000, 590000], // Northumberland
  [590000, 150000] // Kent
]

// Seed faker so the output is the same every run
faker.seed(SEED)

/**
 * Picks a uniformly distributed random number between two bounds.
 * @param {number} min - Lower bound
 * @param {number} max - Upper bound
 * @returns {number} A float between min and max
 */
const uniform = (min, max) => faker.number.float({ min, max })

/**
 * Picks a random number from the standard normal distribution (mean 0,
 * standard deviation 1) using the Box-Muller transform. Faker has no normal
 * distribution of its own.
 * @returns {number} A normally distributed float
 */
const normal = () =>
  Math.sqrt(-2 * Math.log(1 - uniform(0, 1))) *
  Math.cos(2 * Math.PI * uniform(0, 1))

/**
 * Limits a value to a range.
 * @param {number} v - The value to limit
 * @param {number} min - Smallest allowed value
 * @param {number} max - Largest allowed value
 * @returns {number} `v`, or the nearest bound if it falls outside the range
 */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

/**
 * Calculates the signed area of a ring using the shoelace formula.
 * @param {number[][]} ring - Closed ring of [x, y] points (last point repeats the first)
 * @returns {number} Area in square units; positive when the ring is
 * anticlockwise, negative when clockwise
 */
const signedArea = (ring) => {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return sum / 2
}

/**
 * Checks whether two line segments cross each other. Segments that only touch
 * at an end point, or that lie on the same line, do not count as crossing.
 * @param {number[][]} segmentA - The first segment as [[x1, y1], [x2, y2]]
 * @param {number[][]} segmentB - The second segment as [[x3, y3], [x4, y4]]
 * @returns {boolean} true if the segments cross
 */
const segmentsIntersect = ([p1, p2], [p3, p4]) => {
  const d = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const d1 = d(p3, p4, p1)
  const d2 = d(p3, p4, p2)
  const d3 = d(p1, p2, p3)
  const d4 = d(p1, p2, p4)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/**
 * Checks that a ring never crosses itself, by testing every pair of edges
 * that are not next to each other.
 * @param {number[][]} ring - Closed ring of [x, y] points (last point repeats the first)
 * @returns {boolean} true if no two edges cross
 */
const isSimple = (ring) => {
  const n = ring.length - 1
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (segmentsIntersect([ring[i], ring[i + 1]], [ring[j], ring[j + 1]]))
        return false
    }
  }
  return true
}

/**
 * Calculates the shortest distance from a point to a line segment.
 * @param {number[]} point - The point as [x, y]
 * @param {number[]} start - Start of the segment as [x, y]
 * @param {number[]} end - End of the segment as [x, y]
 * @returns {number} The distance from the point to the nearest point on the segment
 */
const distanceToSegment = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * Builds a field-shaped outline centred on the origin, with a radius of roughly
 * 1 unit. It has 4-7 corners placed around a stretched, rotated ellipse. Each
 * edge between corners gets extra points (shared out by edge length) that
 * wobble gently, like a hedge line. The result is not checked for
 * self-intersection; see `isSimple`.
 * @param {number} vertexCount - Number of distinct vertices to produce
 * @returns {number[][]} Open, anticlockwise ring of [x, y] points (the closing
 * point is not included)
 */
const fieldShape = (vertexCount) => {
  const corners = Math.min(vertexCount, Math.floor(uniform(4, 8)))
  const rotation = uniform(0, 2 * Math.PI)
  const stretch = uniform(1, 2.2)
  const cornerPoints = Array.from({ length: corners }, (_, i) => {
    const angle = ((i + uniform(-0.3, 0.3)) / corners) * 2 * Math.PI
    const r = uniform(0.8, 1.2)
    const x = r * Math.cos(angle) * stretch
    const y = r * Math.sin(angle)
    return [
      x * Math.cos(rotation) - y * Math.sin(rotation),
      x * Math.sin(rotation) + y * Math.cos(rotation)
    ]
  })

  // Share out the extra vertices along the edges, weighted by edge length
  const lengths = cornerPoints.map((p, i) => {
    const q = cornerPoints[(i + 1) % corners]
    return Math.hypot(q[0] - p[0], q[1] - p[1])
  })
  const perimeter = lengths.reduce((a, b) => a + b, 0)
  const extra = vertexCount - corners
  const perEdge = lengths.map((l) => Math.floor((extra * l) / perimeter))
  for (let k = perEdge.reduce((a, b) => a + b, 0); k < extra; k++) {
    perEdge[faker.number.int({ max: corners - 1 })]++
  }

  const ring = []
  cornerPoints.forEach((p, i) => {
    const q = cornerPoints[(i + 1) % corners]
    const steps = perEdge[i] + 1
    const nx = -(q[1] - p[1]) / lengths[i]
    const ny = (q[0] - p[0]) / lengths[i]
    // Gentle wobble along each edge, like a hedge line
    const wobble = uniform(0, 0.03) * lengths[i]
    const phase = uniform(0, 2 * Math.PI)
    ring.push(p)
    for (let s = 1; s < steps; s++) {
      const t = (s + uniform(-0.3, 0.3)) / steps
      const offset =
        wobble * Math.sin(Math.PI * t) * Math.sin(phase + 3 * Math.PI * t) +
        uniform(-0.002, 0.002) * lengths[i]
      ring.push([
        p[0] + t * (q[0] - p[0]) + offset * nx,
        p[1] + t * (q[1] - p[1]) + offset * ny
      ])
    }
  })
  return ring
}

/**
 * Rounds a coordinate to 4 decimal places (0.1mm), matching the precision of
 * the original data.
 * @param {number} v - The coordinate to round
 * @returns {number} The rounded coordinate
 */
const round = (v) => Math.round(v * 10000) / 10000

/**
 * Builds the rings of a GeoJSON Polygon: a field shape scaled to the target area
 * and moved to the given grid position. Shapes that cross themselves are thrown
 * away and regenerated. When asked for, a small roughly circular hole is added
 * around the centre, sized well inside the nearest edge so it stays within the
 * exterior.
 * @param {number} cx - Easting of the centre (BNG metres)
 * @param {number} cy - Northing of the centre (BNG metres)
 * @param {number} targetArea - Area of the exterior ring in square metres
 * @param {number} vertexCount - Number of distinct vertices in the exterior ring
 * @param {boolean} withHole - Whether to add an interior ring
 * @returns {number[][][]} Polygon rings following RFC 7946: the anticlockwise
 * exterior first, then the clockwise hole if there is one
 */
const makePolygon = (cx, cy, targetArea, vertexCount, withHole) => {
  let ring
  do {
    ring = fieldShape(vertexCount)
  } while (!isSimple([...ring, ring[0]]))

  const scale = Math.sqrt(targetArea / signedArea([...ring, ring[0]]))
  const toGrid = ([x, y]) => [round(cx + x * scale), round(cy + y * scale)]
  const exterior = ring.map(toGrid)
  exterior.push(exterior[0])
  const rings = [exterior]

  if (withHole) {
    const closed = [...ring, ring[0]]
    let inner = Infinity
    for (let i = 0; i < ring.length; i++) {
      inner = Math.min(
        inner,
        distanceToSegment([0, 0], closed[i], closed[i + 1])
      )
    }
    const holeVertices = Math.floor(uniform(6, 16))
    const holeRadius = inner * uniform(0.2, 0.4)
    const hole = Array.from({ length: holeVertices }, (_, i) => {
      const angle = -(i / holeVertices) * 2 * Math.PI
      const r = holeRadius * uniform(0.8, 1)
      return toGrid([r * Math.cos(angle), r * Math.sin(angle)])
    })
    hole.push(hole[0])
    rings.push(hole)
  }
  return rings
}

/**
 * Calculates the bounding box of a polygon from its exterior ring.
 * @param {number[][][]} rings - Polygon rings; only the first (exterior) is used
 * @returns {number[]} The box as [minX, minY, maxX, maxY]
 */
const bbox = (rings) => {
  const xs = rings[0].map(([x]) => x)
  const ys = rings[0].map(([, y]) => y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/**
 * Checks whether two bounding boxes overlap. Boxes that only touch do not
 * count as overlapping.
 * @param {number[]} a - The first box as [minX, minY, maxX, maxY]
 * @param {number[]} b - The second box as [minX, minY, maxX, maxY]
 * @returns {boolean} true if the boxes overlap
 */
const overlaps = (a, b) =>
  a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

// Bounding boxes of every parcel generated so far, used to stop overlaps
const placed = []

/**
 * Builds a polygon at a random spot near one of the `ANCHORS`. If its bounding
 * box would overlap a parcel already placed, it tries again somewhere else.
 * Records the new parcel's bounding box in `placed`.
 * @param {number} targetArea - Area of the exterior ring in square metres
 * @param {number} vertexCount - Number of distinct vertices in the exterior ring
 * @param {boolean} withHole - Whether to add an interior ring
 * @returns {number[][][]} Polygon rings, as returned by `makePolygon`
 */
const place = (targetArea, vertexCount, withHole) => {
  for (;;) {
    const [ax, ay] = faker.helpers.arrayElement(ANCHORS)
    const rings = makePolygon(
      ax + uniform(-SCATTER_METRES, SCATTER_METRES),
      ay + uniform(-SCATTER_METRES, SCATTER_METRES),
      targetArea,
      vertexCount,
      withHole
    )
    const box = bbox(rings)
    if (!placed.some((other) => overlaps(box, other))) {
      placed.push(box)
      return rings
    }
  }
}

/**
 * Picks a parcel area from a log-normal distribution fitted to the original
 * parcels (median ~12,600m²), limited to 120-150,000m².
 * @returns {number} Area in whole square metres
 */
const sampleArea = () =>
  Math.round(clamp(Math.exp(9.445 + 1.428 * normal()), 120, 150000))

/**
 * Picks the number of vertices in a parcel's exterior ring from a log-normal
 * distribution fitted to the original parcels, limited to 5-370 points including
 * the closing point.
 * @returns {number} Number of distinct vertices (the closing point is not counted)
 */
const sampleVertices = () =>
  Math.round(clamp(Math.exp(4.112 + 0.79 * normal()), 5, 370)) - 1

/**
 * Generates COUNT GeoJSON geometries. All are Polygons apart from the one at
 * MULTIPOLYGON_INDEX, which is a MultiPolygon of two neighbouring fields.
 */
const geometries = Array.from({ length: COUNT }, (_, i) => {
  const area = sampleArea()
  const vertices = sampleVertices()
  const withHole = faker.datatype.boolean(HOLE_PROBABILITY)

  if (i !== MULTIPOLYGON_INDEX) {
    return { type: 'Polygon', coordinates: place(area, vertices, withHole) }
  }

  // Two neighbouring fields split by a track
  const first = place(area, vertices, true)
  const [minX, minY, maxX] = bbox(first)
  const secondArea = Math.round(area * uniform(0.3, 0.8))
  const second = makePolygon(
    maxX + 20 + Math.sqrt(secondArea),
    minY + Math.sqrt(secondArea),
    secondArea,
    Math.max(4, Math.round(vertices / 3)),
    false
  )
  placed.push([minX, minY, ...bbox(second).slice(2)])
  return { type: 'MultiPolygon', coordinates: [first, second] }
})

const json = JSON.stringify(geometries, null, 2).replace(
  /\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g,
  '[$1, $2]'
)
fs.writeFileSync(
  new URL('../src/factories/valid-geometries.json', import.meta.url),
  json + '\n'
)
console.log(`Wrote ${geometries.length} geometries`)
