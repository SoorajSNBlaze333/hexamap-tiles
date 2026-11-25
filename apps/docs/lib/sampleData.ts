import {
  AUSTRALIA,
  CHINA,
  INDIA,
  USA,
  projectLngLat,
  regionAtPoint,
  regionIdAtPoint,
  unprojectPoint,
  type Aggregate,
  type Country,
  type HexDatum,
  type PaletteName,
} from "hexamap-tiles";

// Demo datasets. Population totals are real census figures; everything else is modelled on real
// geography (where people live, fault zones, fire regions, highways) but is not real event data.

export type CountryId = "us" | "in" | "cn" | "au";

const COUNTRY: Record<CountryId, Country> = { us: USA, in: INDIA, cn: CHINA, au: AUSTRALIA };

// ------------------------------------------------------------------ randomness

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type LngLat = [lng: number, lat: number];

// ------------------------------------------------------------------ census

/** Population in millions. USA: 2020 census. India: 2011 census. China: 2020 census. Australia: 2021 census. */
const POPULATION: Record<CountryId, Record<string, number>> = {
  us: {
    AL: 5.02, AK: 0.73, AZ: 7.15, AR: 3.01, CA: 39.54, CO: 5.77, CT: 3.61, DE: 0.99, DC: 0.69, FL: 21.54,
    GA: 10.71, HI: 1.46, ID: 1.84, IL: 12.81, IN: 6.79, IA: 3.19, KS: 2.94, KY: 4.51, LA: 4.66, ME: 1.36,
    MD: 6.18, MA: 7.03, MI: 10.08, MN: 5.71, MS: 2.96, MO: 6.15, MT: 1.08, NE: 1.96, NV: 3.1, NH: 1.38,
    NJ: 9.29, NM: 2.12, NY: 20.2, NC: 10.44, ND: 0.78, OH: 11.8, OK: 3.96, OR: 4.24, PA: 13.0, RI: 1.1,
    SC: 5.12, SD: 0.89, TN: 6.91, TX: 29.15, UT: 3.27, VT: 0.64, VA: 8.63, WA: 7.71, WV: 1.79, WI: 5.89, WY: 0.58,
  },
  in: {
    UP: 199.8, MH: 112.4, BR: 104.1, WB: 91.3, MP: 72.6, TN: 72.1, RJ: 68.5, KA: 61.1, GJ: 60.4, AP: 49.4,
    OR: 42.0, TG: 35.0, KL: 33.4, JH: 33.0, AS: 31.2, PB: 27.7, CT: 25.5, HR: 25.4, DL: 16.8, JK: 12.3,
    UT: 10.1, HP: 6.86, TR: 3.67, ML: 2.97, MN: 2.86, NL: 1.98, GA: 1.46, AR: 1.38, PY: 1.25, MZ: 1.1,
    CH: 1.06, SK: 0.61, DH: 0.59, AN: 0.38, LA: 0.27, LD: 0.064,
  },
  cn: {
    GD: 126.0, SD: 101.5, HA: 99.4, JS: 84.7, SC: 83.7, HE: 74.6, HN: 66.4, ZJ: 64.6, AH: 61.0, HB: 57.8,
    GX: 50.1, YN: 47.2, JX: 45.2, LN: 42.6, FJ: 41.5, SN: 39.5, GZ: 38.6, SX: 34.9, CQ: 32.1, HL: 31.9,
    XJ: 25.9, GS: 25.0, SH: 24.9, JL: 24.1, NM: 24.0, BJ: 21.9, TJ: 13.9, HI: 10.1, HK: 7.47, NX: 7.2,
    QH: 5.9, XZ: 3.6, MO: 0.68,
  },
  au: { NSW: 8.07, VIC: 6.5, QLD: 5.16, WA: 2.66, SA: 1.78, TAS: 0.56, ACT: 0.45, NT: 0.23, JBT: 0.0003 },
};

/**
 * How far (map units) rural settlement typically extends from the cities. Small towns are placed with
 * a probability that falls off with distance to the nearest city: India's countryside is populated
 * almost everywhere, while Australia's interior is nearly empty.
 */
const SETTLEMENT_RANGE: Record<CountryId, number> = { us: 90, in: 400, cn: 100, au: 22 };

const CENSUS_LABEL: Record<CountryId, string> = {
  us: "2020 census",
  in: "2011 census",
  cn: "2020 census",
  au: "2021 census",
};

// [name, lng, lat, metro population in millions]
type City = [name: string, lng: number, lat: number, pop: number];

const CITIES: Record<CountryId, City[]> = {
  us: [
    ["New York", -74.006, 40.713, 19.5], ["Los Angeles", -118.244, 34.052, 12.8], ["Chicago", -87.63, 41.878, 9.4],
    ["Dallas", -96.797, 32.777, 7.6], ["Houston", -95.369, 29.76, 7.1], ["Washington", -77.037, 38.907, 6.3],
    ["Philadelphia", -75.165, 39.953, 6.2], ["Miami", -80.192, 25.762, 6.1], ["Atlanta", -84.388, 33.749, 6.1],
    ["Boston", -71.059, 42.36, 4.9], ["Phoenix", -112.074, 33.448, 4.8], ["San Francisco", -122.419, 37.775, 4.6],
    ["Riverside", -117.396, 33.953, 4.6], ["Detroit", -83.046, 42.331, 4.4], ["Seattle", -122.332, 47.606, 4.0],
    ["Minneapolis", -93.265, 44.978, 3.7], ["San Diego", -117.161, 32.716, 3.3], ["Tampa", -82.458, 27.951, 3.2],
    ["Denver", -104.99, 39.739, 3.0], ["Baltimore", -76.612, 39.29, 2.8], ["St. Louis", -90.199, 38.627, 2.8],
    ["Orlando", -81.379, 28.538, 2.7], ["Charlotte", -80.843, 35.227, 2.7], ["San Antonio", -98.494, 29.424, 2.6],
    ["Portland", -122.676, 45.523, 2.5], ["Sacramento", -121.494, 38.582, 2.4], ["Pittsburgh", -79.996, 40.441, 2.4],
    ["Austin", -97.743, 30.267, 2.3], ["Las Vegas", -115.14, 36.17, 2.3], ["Cincinnati", -84.512, 39.103, 2.3],
    ["Kansas City", -94.579, 39.1, 2.2], ["Columbus", -82.999, 39.961, 2.1], ["Indianapolis", -86.158, 39.768, 2.1],
    ["Cleveland", -81.694, 41.499, 2.1], ["San Jose", -121.886, 37.338, 2.0], ["Nashville", -86.781, 36.163, 2.0],
    ["Virginia Beach", -76.0, 36.85, 1.8], ["Jacksonville", -81.656, 30.332, 1.6], ["Milwaukee", -87.907, 43.039, 1.6],
    ["Raleigh", -78.639, 35.78, 1.4], ["Oklahoma City", -97.516, 35.468, 1.4], ["Memphis", -90.049, 35.15, 1.3],
    ["Louisville", -85.759, 38.253, 1.3], ["Salt Lake City", -111.891, 40.761, 1.3], ["New Orleans", -90.072, 29.951, 1.3],
    ["Richmond", -77.436, 37.541, 1.3], ["Birmingham", -86.802, 33.521, 1.1], ["Buffalo", -78.878, 42.886, 1.2],
    ["Hartford", -72.685, 41.764, 1.2], ["Tucson", -110.975, 32.222, 1.0], ["Honolulu", -157.858, 21.307, 1.0],
    ["Tulsa", -95.993, 36.154, 1.0], ["Fresno", -119.787, 36.738, 1.0], ["Omaha", -95.935, 41.257, 1.0],
    ["Albuquerque", -106.65, 35.084, 0.9], ["Boise", -116.202, 43.615, 0.8], ["El Paso", -106.485, 31.762, 0.9],
    ["Baton Rouge", -91.187, 30.451, 0.9], ["Little Rock", -92.289, 34.746, 0.75], ["Des Moines", -93.609, 41.587, 0.7],
    ["Wichita", -97.336, 37.687, 0.65], ["Providence", -71.413, 41.824, 1.7], ["Spokane", -117.426, 47.659, 0.6],
    ["Jackson", -90.185, 32.299, 0.6], ["Charleston", -79.931, 32.776, 0.8], ["Lafayette", -92.02, 30.224, 0.5],
    ["Lake Charles", -93.217, 30.226, 0.2], ["Shreveport", -93.75, 32.525, 0.4], ["Anchorage", -149.9, 61.218, 0.4],
    ["Portland ME", -70.256, 43.661, 0.55], ["Manchester", -71.455, 42.991, 0.42], ["Burlington", -73.212, 44.476, 0.23],
    ["Wilmington", -75.546, 39.746, 0.7], ["Charleston WV", -81.633, 38.35, 0.2], ["Madison", -89.401, 43.073, 0.68],
    ["Lincoln", -96.685, 40.814, 0.34], ["Reno", -119.813, 39.53, 0.5], ["Sioux Falls", -96.731, 43.546, 0.28],
    ["Fargo", -96.789, 46.877, 0.25], ["Billings", -108.501, 45.783, 0.18], ["Cheyenne", -104.82, 41.14, 0.1],
  ],
  in: [
    ["Delhi", 77.209, 28.614, 16.3], ["Mumbai", 72.878, 19.076, 18.4], ["Kolkata", 88.364, 22.573, 14.1],
    ["Chennai", 80.271, 13.083, 8.7], ["Bengaluru", 77.595, 12.972, 8.5], ["Hyderabad", 78.487, 17.385, 7.7],
    ["Ahmedabad", 72.571, 23.023, 6.4], ["Pune", 73.857, 18.52, 5.0], ["Surat", 72.831, 21.17, 4.6],
    ["Jaipur", 75.787, 26.912, 3.0], ["Kanpur", 80.332, 26.449, 2.9], ["Lucknow", 80.946, 26.847, 2.9],
    ["Nagpur", 79.088, 21.146, 2.5], ["Indore", 75.858, 22.72, 2.2], ["Patna", 85.138, 25.594, 2.0],
    ["Bhopal", 77.413, 23.26, 1.9], ["Ludhiana", 75.857, 30.901, 1.6], ["Agra", 78.008, 27.177, 1.7],
    ["Vadodara", 73.181, 22.307, 1.8], ["Nashik", 73.79, 19.998, 1.6], ["Varanasi", 82.974, 25.318, 1.4],
    ["Srinagar", 74.797, 34.084, 1.3], ["Ranchi", 85.31, 23.344, 1.1], ["Coimbatore", 76.956, 11.017, 2.1],
    ["Kochi", 76.267, 9.931, 2.1], ["Madurai", 78.12, 9.925, 1.5], ["Thiruvananthapuram", 76.937, 8.524, 1.7],
    ["Visakhapatnam", 83.218, 17.687, 1.7], ["Vijayawada", 80.648, 16.506, 1.5], ["Guwahati", 91.736, 26.144, 1.0],
    ["Chandigarh", 76.779, 30.733, 1.0], ["Raipur", 81.63, 21.251, 1.1], ["Bhubaneswar", 85.824, 20.296, 0.9],
    ["Cuttack", 85.88, 20.46, 0.7], ["Dehradun", 78.032, 30.316, 0.7], ["Jammu", 74.857, 32.727, 0.65],
    ["Mysuru", 76.639, 12.296, 1.0], ["Jodhpur", 73.024, 26.238, 1.1], ["Amritsar", 74.872, 31.634, 1.2],
    ["Puducherry", 79.809, 11.941, 0.65], ["Panaji", 73.828, 15.49, 0.3], ["Shimla", 77.173, 31.105, 0.17],
    ["Imphal", 93.938, 24.817, 0.4], ["Agartala", 91.287, 23.831, 0.4], ["Shillong", 91.893, 25.578, 0.35],
    ["Gangtok", 88.612, 27.338, 0.1], ["Aizawl", 92.718, 23.727, 0.3], ["Kohima", 94.109, 25.674, 0.1],
    ["Itanagar", 93.616, 27.084, 0.06], ["Leh", 77.585, 34.152, 0.03], ["Port Blair", 92.726, 11.623, 0.1],
    ["Balasore", 86.93, 21.49, 0.14], ["Haldia", 88.07, 22.06, 0.2], ["Kharagpur", 87.23, 22.35, 0.3],
  ],
  cn: [
    ["Shanghai", 121.474, 31.23, 24.9], ["Beijing", 116.407, 39.904, 21.9], ["Chongqing", 106.551, 29.563, 16.0],
    ["Guangzhou", 113.264, 23.129, 18.7], ["Shenzhen", 114.058, 22.543, 17.6], ["Chengdu", 104.066, 30.573, 16.3],
    ["Tianjin", 117.2, 39.084, 13.9], ["Wuhan", 114.305, 30.593, 12.3], ["Xi'an", 108.94, 34.341, 12.9],
    ["Hangzhou", 120.155, 30.274, 12.2], ["Suzhou", 120.585, 31.299, 12.7], ["Zhengzhou", 113.625, 34.747, 12.6],
    ["Dongguan", 113.752, 23.021, 10.5], ["Foshan", 113.122, 23.022, 9.5], ["Nanjing", 118.797, 32.06, 9.3],
    ["Qingdao", 120.383, 36.067, 10.1], ["Changsha", 112.939, 28.228, 10.0], ["Harbin", 126.535, 45.803, 10.0],
    ["Shenyang", 123.429, 41.797, 9.1], ["Hefei", 117.227, 31.821, 9.4], ["Jinan", 117.12, 36.651, 9.2],
    ["Changchun", 125.324, 43.817, 9.1], ["Kunming", 102.833, 24.88, 8.5], ["Nanning", 108.366, 22.817, 8.7],
    ["Fuzhou", 119.296, 26.074, 8.3], ["Shijiazhuang", 114.515, 38.042, 11.2], ["Dalian", 121.615, 38.914, 7.5],
    ["Ningbo", 121.55, 29.875, 9.4], ["Wuxi", 120.3, 31.57, 7.5], ["Xiamen", 118.089, 24.48, 5.2],
    ["Nanchang", 115.858, 28.683, 6.3], ["Guiyang", 106.63, 26.647, 6.0], ["Taiyuan", 112.549, 37.871, 5.3],
    ["Urumqi", 87.617, 43.825, 4.1], ["Lanzhou", 103.834, 36.061, 4.4], ["Hohhot", 111.749, 40.842, 3.4],
    ["Baotou", 109.84, 40.66, 2.7], ["Yinchuan", 106.231, 38.487, 2.9], ["Xining", 101.778, 36.617, 2.5],
    ["Haikou", 110.199, 20.044, 2.9], ["Sanya", 109.51, 18.25, 1.0], ["Lhasa", 91.117, 29.647, 0.9],
    ["Kashgar", 75.99, 39.47, 0.7], ["Hong Kong", 114.12, 22.4, 7.4], ["Macau", 113.55, 22.17, 0.68],
    ["Zhanjiang", 110.36, 21.27, 7.0], ["Maoming", 110.92, 21.66, 6.2], ["Jiangmen", 113.08, 22.58, 4.8],
    ["Liuzhou", 109.41, 24.33, 4.2], ["Guilin", 110.29, 25.27, 4.9], ["Yulin", 110.15, 22.63, 5.8],
    ["Wuzhou", 111.28, 23.48, 2.8], ["Tangshan", 118.18, 39.63, 7.7], ["Xuzhou", 117.18, 34.26, 9.1],
    ["Linyi", 118.35, 35.1, 11.0], ["Mianyang", 104.68, 31.47, 4.9], ["Daqing", 125.1, 46.59, 2.8],
  ],
  au: [
    ["Sydney", 151.209, -33.868, 5.26], ["Melbourne", 144.963, -37.814, 4.98], ["Brisbane", 153.026, -27.47, 2.56],
    ["Perth", 115.861, -31.952, 2.12], ["Adelaide", 138.6, -34.929, 1.39], ["Gold Coast", 153.4, -28.017, 0.7],
    ["Newcastle", 151.776, -32.928, 0.51], ["Canberra", 149.13, -35.281, 0.45], ["Sunshine Coast", 153.07, -26.65, 0.36],
    ["Wollongong", 150.894, -34.424, 0.3], ["Geelong", 144.361, -38.149, 0.29], ["Hobart", 147.327, -42.882, 0.25],
    ["Townsville", 146.817, -19.259, 0.18], ["Cairns", 145.771, -16.919, 0.16], ["Darwin", 130.844, -12.463, 0.15],
    ["Toowoomba", 151.952, -27.561, 0.14], ["Ballarat", 143.85, -37.562, 0.11], ["Bendigo", 144.28, -36.757, 0.1],
    ["Launceston", 147.138, -41.433, 0.09], ["Mackay", 149.186, -21.141, 0.08], ["Rockhampton", 150.51, -23.378, 0.08],
    ["Bunbury", 115.64, -33.33, 0.08], ["Bundaberg", 152.35, -24.87, 0.07], ["Albury", 146.92, -36.08, 0.05],
    ["Wagga Wagga", 147.369, -35.118, 0.06], ["Mildura", 142.159, -34.208, 0.05], ["Dubbo", 148.604, -32.242, 0.04],
    ["Ingham", 146.16, -18.65, 0.005], ["Charters Towers", 146.26, -20.08, 0.008], ["Mount Isa", 139.492, -20.725, 0.02],
    ["Alice Springs", 133.881, -23.698, 0.03], ["Kalgoorlie", 121.466, -30.749, 0.03], ["Broome", 122.236, -17.962, 0.015],
    ["Port Hedland", 118.611, -20.312, 0.015], ["Albany", 117.884, -35.023, 0.04], ["Geraldton", 114.61, -28.77, 0.04],
  ],
};

// ------------------------------------------------------------- geography helpers

interface RegionShape {
  id: string;
  code: string;
  name: string;
  bbox: [number, number, number, number];
}

function regionShapes(country: Country): Map<string, RegionShape> {
  const out = new Map<string, RegionShape>();
  for (const g of country.geometry.regions) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const ring of g.rings) {
      for (let i = 0; i < ring.length; i += 2) {
        x0 = Math.min(x0, ring[i]!); x1 = Math.max(x1, ring[i]!);
        y0 = Math.min(y0, ring[i + 1]!); y1 = Math.max(y1, ring[i + 1]!);
      }
    }
    const info = country.regions.find((r) => r.id === g.id);
    if (info) out.set(info.code, { id: g.id, code: info.code, name: info.name, bbox: [x0, y0, x1, y1] });
  }
  return out;
}

/** A uniformly random map-space point inside a region (rejection sampling in its bbox). */
function randomPointIn(country: Country, r: RegionShape, rand: () => number): [number, number] | null {
  const [x0, y0, x1, y1] = r.bbox;
  for (let i = 0; i < 400; i++) {
    const x = x0 + rand() * (x1 - x0);
    const y = y0 + rand() * (y1 - y0);
    if (regionIdAtPoint(x, y, country) === r.id) return [x, y];
  }
  return null;
}

const onLand = (country: Country, [lng, lat]: LngLat) => {
  const p = projectLngLat(lng, lat, country);
  return p ? regionAtPoint(p[0], p[1], country) : undefined;
};

/** Approximate distance in km between two lng/lat points. */
function km([a, b]: LngLat, [c, d]: LngLat) {
  const k = Math.cos((((b + d) / 2) * Math.PI) / 180);
  return Math.hypot((a - c) * k, b - d) * 111;
}

/** Distance (km) from a point to a polyline, and how far along the line (0–1) the nearest point is. */
function distanceToPath(p: LngLat, path: LngLat[]): { d: number; t: number } {
  let best = { d: Infinity, t: 0 };
  const lens = path.slice(1).map((q, i) => km(path[i]!, q));
  const total = lens.reduce((a, b) => a + b, 0);
  let acc = 0;
  const k = Math.cos((p[1] * Math.PI) / 180);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!, b = path[i + 1]!;
    const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-9;
    const s = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2));
    const d = Math.hypot(px - (ax + s * (bx - ax)), py - (ay + s * (by - ay))) * 111;
    if (d < best.d) best = { d, t: (acc + s * lens[i]!) / (total || 1) };
    acc += lens[i]!;
  }
  return best;
}

/** Random point along a polyline (uniform by length), pushed sideways by a gaussian of `width` degrees. */
function pointNearPath(path: LngLat[], width: number, rand: () => number): LngLat {
  if (path.length === 1) return [path[0]![0] + gaussian(rand) * width, path[0]![1] + gaussian(rand) * width];
  const lens = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i]![0], q[1] - path[i]![1]));
  let r = rand() * lens.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < lens.length - 1 && r > lens[i]!) r -= lens[i++]!;
  const a = path[i]!, b = path[i + 1]!;
  const s = Math.min(1, r / (lens[i] || 1));
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const n = Math.hypot(dx, dy) || 1;
  const off = gaussian(rand) * width;
  const along = gaussian(rand) * width * 0.3;
  return [a[0] + dx * s - (dy / n) * off + (dx / n) * along, a[1] + dy * s + (dx / n) * off + (dy / n) * along];
}

// ------------------------------------------------------------------ population

export interface PointDatum extends HexDatum {
  lat: number;
  lng: number;
  value: number;
  /** Region code the point was generated in (only set by the population model). */
  region?: string;
  /** Shown in the playground's "top places" list. */
  city: string;
}

/**
 * People as weighted points: each region gets points in proportion to its census population, and each
 * point carries an equal share of it, so per-region sums match the census. Within a region, people live
 * in its cities (by metro population) or in clusters of small towns spread across the region.
 */
function populationPoints(id: CountryId, total: number, seed: number): PointDatum[] {
  const country = COUNTRY[id];
  const rand = mulberry32(seed);
  const shapes = regionShapes(country);
  const pops = POPULATION[id];
  const sum = Object.values(pops).reduce((a, b) => a + b, 0);

  const citiesByRegion = new Map<string, Array<{ city: City; x: number; y: number }>>();
  const allCities: Array<[number, number]> = [];
  const range = SETTLEMENT_RANGE[id];
  const nearCityOdds = ([x, y]: [number, number]) => {
    let d = Infinity;
    for (const [cx, cy] of allCities) d = Math.min(d, Math.hypot(cx - x, cy - y));
    return Math.max(0.01, Math.exp(-d / range));
  };
  for (const city of CITIES[id]) {
    const p = projectLngLat(city[1], city[2], country);
    const r = p && regionAtPoint(p[0], p[1], country);
    if (!p || !r) continue;
    allCities.push([p[0], p[1]]);
    let list = citiesByRegion.get(r.code);
    if (!list) citiesByRegion.set(r.code, (list = []));
    list.push({ city, x: p[0], y: p[1] });
  }

  const out: PointDatum[] = [];
  for (const [code, popM] of Object.entries(pops)) {
    const shape = shapes.get(code);
    if (!shape) continue;
    const n = Math.max(4, Math.round((total * popM) / sum));
    const each = (popM * 1e6) / n;
    const cities = citiesByRegion.get(code) ?? [];
    const cityPop = cities.reduce((a, c) => a + c.city[3], 0);
    const nUrban = Math.round(n * Math.min(0.85, cityPop / popM));

    // Small towns: random seeds in the region, with people clustered around them.
    const towns: Array<[number, number]> = [];
    for (let i = 0; i < Math.max(2, Math.round((n - nUrban) / 5)); i++) {
      // Try a few candidates; keep the first that passes, else the one nearest a city.
      let t: [number, number] | null = null;
      let bestOdds = -1;
      for (let k = 0; k < 12; k++) {
        const c = randomPointIn(country, shape, rand);
        if (!c) continue;
        const odds = nearCityOdds(c);
        if (rand() < odds) {
          t = c;
          break;
        }
        if (odds > bestOdds) [t, bestOdds] = [c, odds];
      }
      if (t) towns.push(t);
    }

    for (let i = 0; i < n; i++) {
      let xy: [number, number] | null = null;
      let label = `${shape.name} (towns & rural)`;
      if (i < nUrban && cities.length) {
        let r = rand() * cityPop;
        const c = cities.find((c) => (r -= c.city[3]) <= 0) ?? cities[0]!;
        const spread = 1.2 + 1.6 * Math.sqrt(c.city[3]);
        for (let k = 0; k < 8 && !xy; k++) {
          const x = c.x + gaussian(rand) * spread, y = c.y + gaussian(rand) * spread;
          if (regionIdAtPoint(x, y, country) === shape.id) xy = [x, y];
        }
        xy ??= [c.x, c.y];
        label = c.city[0];
      } else if (towns.length) {
        const t = towns[Math.floor(rand() * towns.length)]!;
        for (let k = 0; k < 8 && !xy; k++) {
          const x = t[0] + gaussian(rand) * 8, y = t[1] + gaussian(rand) * 8;
          if (regionIdAtPoint(x, y, country) === shape.id) xy = [x, y];
        }
        xy ??= t;
      }
      if (!xy) continue;
      const ll = unprojectPoint(xy[0], xy[1], country);
      if (ll) out.push({ lng: ll[0], lat: ll[1], value: each, city: label, region: code });
    }
  }
  return out;
}

// --------------------------------------------------------------- power outages

interface StormScenario {
  name: string;
  blurb: string;
  /** Track from landfall inland. */
  track: LngLat[];
  /** Radius (km) of damaging winds at landfall. */
  radius: number;
  /** People per electricity customer (household size). */
  perCustomer: number;
}

const STORMS: Record<CountryId, StormScenario> = {
  us: {
    name: "Hurricane",
    blurb: "a Category 3 hurricane lands near Lake Charles, LA and tracks north into Arkansas.",
    track: [[-93.3, 29.5], [-93.3, 30.5], [-93.1, 31.8], [-92.6, 33.0], [-91.8, 34.2], [-90.8, 35.3]],
    radius: 135,
    perCustomer: 2.5,
  },
  in: {
    name: "Cyclone",
    blurb: "a severe cyclone lands near Puri, Odisha and moves north-east into West Bengal.",
    track: [[85.9, 19.5], [86.0, 20.3], [86.5, 21.2], [87.3, 22.1], [88.3, 23.1], [89.2, 24.2]],
    radius: 110,
    perCustomer: 4.5,
  },
  cn: {
    name: "Typhoon",
    blurb: "a super typhoon lands near Zhanjiang, Guangdong and weakens over Guangxi.",
    track: [[111.6, 20.6], [110.8, 21.4], [109.9, 22.3], [109.0, 23.1], [107.9, 23.8], [106.6, 24.3]],
    radius: 130,
    perCustomer: 3,
  },
  au: {
    name: "Cyclone",
    blurb: "a Category 4 cyclone lands near Ingham, Queensland and moves inland.",
    track: [[147.3, -18.1], [146.3, -18.7], [145.4, -19.5], [144.3, -20.4], [143.0, -21.4]],
    radius: 150,
    perCustomer: 2.5,
  },
};

/** Customers without power: people near the storm track lose power with distance, less as the storm weakens. */
function outagePoints(id: CountryId): PointDatum[] {
  const storm = STORMS[id];
  const people = populationPoints(id, 14000, 101);
  const rand = mulberry32(103);
  const out: PointDatum[] = [];
  for (const p of people) {
    const { d, t } = distanceToPath([p.lng, p.lat], storm.track);
    const radius = storm.radius * (1 + t * 0.6); // the wind field spreads as it weakens…
    const strength = 1 - 0.85 * t; // …and does less damage inland
    const share = 0.92 * strength * Math.exp(-((d / radius) ** 2)) * (0.75 + rand() * 0.5);
    if (share < 0.02) continue;
    // Split each point into a few utility reports.
    const customers = (p.value / storm.perCustomer) * Math.min(1, share);
    const parts = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < parts; i++) {
      out.push({
        lng: p.lng + gaussian(rand) * 0.04,
        lat: p.lat + gaussian(rand) * 0.04,
        value: Math.round(customers / parts),
        city: p.city,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ earthquakes

/** A source zone: points scatter along `path` (or around a single point) with a gaussian `width` in degrees. */
type Zone = [name: string, n: number, width: number, path: LngLat[]];

const QUAKE_ZONES: Record<CountryId, Zone[]> = {
  us: [
    ["Alaska–Aleutian subduction zone", 1100, 0.9, [[-165, 54.3], [-158, 56], [-152, 58.8], [-148, 61.2], [-144, 61.5]]],
    ["Interior Alaska", 350, 1.4, [[-152, 63.5], [-146, 64.5], [-142, 63.2]]],
    ["San Andreas fault system", 420, 0.35, [[-115.5, 32.7], [-116.6, 34], [-118.5, 34.8], [-120.6, 36.1], [-121.8, 37.4], [-122.8, 38.6], [-124.2, 40.3]]],
    ["Eastern California & Walker Lane", 160, 0.4, [[-117.3, 35.5], [-118.0, 37.0], [-119.0, 38.3], [-119.8, 39.6]]],
    ["Hawaiʻi volcanic zone", 260, 0.25, [[-155.3, 19.3], [-155.6, 19.6], [-155.2, 19.9]]],
    ["Cascadia & Puget Sound", 80, 0.6, [[-122.3, 45.5], [-122.5, 47.0], [-122.8, 48.6]]],
    ["Intermountain Seismic Belt", 130, 0.5, [[-112.0, 38.5], [-111.8, 40.6], [-111.3, 42.6], [-110.6, 44.6], [-112.5, 46.7]]],
    ["Oklahoma–Kansas (induced)", 110, 0.5, [[-98.8, 35.6], [-97.8, 36.2], [-97.5, 36.9]]],
    ["New Madrid seismic zone", 60, 0.35, [[-90.0, 35.8], [-89.6, 36.6], [-89.3, 37.1]]],
    ["Texas Permian Basin (induced)", 90, 0.4, [[-104.0, 31.4], [-102.8, 31.7], [-102.2, 32.2]]],
    ["Northeast & Appalachians", 25, 1.3, [[-82.5, 35.8], [-78.5, 38.2], [-74.5, 42.8], [-70.5, 44.8]]],
  ],
  in: [
    ["Western Himalaya", 110, 0.5, [[73.8, 34.6], [75.2, 33.4], [76.8, 32.4], [78.2, 31.2]]],
    ["Central Himalaya (Uttarakhand)", 80, 0.4, [[78.2, 31.2], [79.4, 30.3], [80.4, 29.6]]],
    ["Hindu Kush–Karakoram", 90, 0.6, [[74.4, 36.4], [75.8, 35.6], [77.6, 35.4]]],
    ["Northeast India & Indo-Burman ranges", 230, 0.5, [[92.0, 27.4], [94.0, 27.8], [95.4, 26.8], [94.4, 25.0], [93.4, 23.6], [92.8, 22.6]]],
    ["Shillong Plateau", 70, 0.35, [[90.6, 25.6], [92.2, 25.7]]],
    ["Andaman–Nicobar arc", 260, 0.35, [[92.9, 13.8], [92.7, 12.2], [93.2, 10.4], [93.6, 8.6], [93.8, 7.0]]],
    ["Kutch rift (Gujarat)", 55, 0.4, [[69.6, 23.4], [70.6, 23.5]]],
    ["Koyna–Warna (Maharashtra)", 30, 0.2, [[73.75, 17.2]]],
    ["Sikkim Himalaya", 45, 0.3, [[88.2, 27.6], [88.8, 27.3]]],
  ],
  cn: [
    ["Longmenshan fault (Sichuan)", 160, 0.4, [[103.0, 30.3], [104.0, 31.2], [105.2, 32.3]]],
    ["Xianshuihe fault (Sichuan)", 90, 0.35, [[100.2, 31.6], [101.5, 30.4], [102.3, 29.2]]],
    ["Yunnan seismic zone", 170, 0.7, [[99.5, 27.0], [100.4, 25.6], [101.6, 24.4], [102.8, 23.6]]],
    ["Tibetan Plateau", 180, 1.6, [[82.0, 33.0], [86.0, 31.5], [90.0, 31.0], [94.0, 31.5]]],
    ["Tian Shan (Xinjiang)", 200, 0.8, [[75.5, 39.8], [79.0, 41.3], [83.0, 42.8], [87.0, 43.6]]],
    ["Qilian Shan & Gansu", 110, 0.6, [[96.0, 38.8], [99.5, 37.8], [102.5, 36.7], [105.0, 35.6]]],
    ["Kunlun fault (Qinghai)", 80, 0.6, [[91.0, 35.8], [95.5, 35.6], [99.5, 34.6]]],
    ["North China Plain (Tangshan–Xingtai)", 70, 0.6, [[114.6, 37.2], [116.5, 38.6], [118.2, 39.6]]],
    ["Southeast coast (Fujian–Guangdong)", 40, 0.5, [[116.5, 23.2], [118.5, 24.6]]],
  ],
  au: [
    ["South West Seismic Zone (WA)", 70, 0.45, [[116.6, -31.3], [117.3, -32.0], [117.6, -32.6]]],
    ["Flinders Ranges (SA)", 45, 0.45, [[138.6, -31.5], [138.7, -33.2], [138.9, -35.0]]],
    ["Gippsland & Victorian Alps", 50, 0.5, [[146.0, -37.3], [147.0, -38.0]]],
    ["Tennant Creek & Petermann (NT)", 30, 0.6, [[133.7, -19.8], [131.5, -24.8], [129.8, -25.9]]],
    ["Central Queensland", 25, 0.8, [[150.0, -24.0], [151.5, -25.4]]],
    ["NSW – Lake Burragorang & Hunter", 25, 0.5, [[150.3, -34.0], [151.0, -32.6]]],
    ["Kimberley & Pilbara (WA)", 25, 1.0, [[121.0, -18.5], [118.0, -21.5]]],
  ],
};

/**
 * Points for each zone. With `clusterSize`, points come in tight clusters (e.g. individual fires)
 * whose centres are spread over the zone; otherwise they scatter over the zone directly.
 */
function zonePoints(
  id: CountryId,
  zones: Zone[],
  seed: number,
  value: (rand: () => number) => number,
  clusterSize?: number,
): PointDatum[] {
  const country = COUNTRY[id];
  const rand = mulberry32(seed);
  const out: PointDatum[] = [];
  for (const [name, n, width, path] of zones) {
    const centres: LngLat[] = [];
    if (clusterSize) {
      for (let tries = 0; centres.length < Math.ceil(n / clusterSize) && tries < n; tries++) {
        const c = pointNearPath(path, width, rand);
        if (onLand(country, c)) centres.push(c);
      }
    }
    let made = 0;
    for (let tries = 0; made < n && tries < n * 6; tries++) {
      let p: LngLat;
      if (centres.length) {
        // Cluster sizes vary a lot: a few big fires, many small ones.
        const c = centres[Math.floor(Math.pow(rand(), 1.8) * centres.length)]!;
        p = [c[0] + gaussian(rand) * 0.22, c[1] + gaussian(rand) * 0.16];
      } else p = pointNearPath(path, width, rand);
      if (!onLand(country, p)) continue;
      out.push({ lng: p[0], lat: p[1], value: value(rand), city: name });
      made++;
    }
  }
  return out;
}

/** Gutenberg–Richter (b = 1): each step of +1 magnitude is 10× rarer. */
const magnitude = (rand: () => number) => Math.round((2.5 - Math.log10(1 - rand() * 0.9999)) * 10) / 10;

// -------------------------------------------------------------------- wildfires

const FIRE_ZONES: Record<CountryId, Zone[]> = {
  us: [
    ["Northern California & Klamath", 900, 0.8, [[-123.4, 39.6], [-122.8, 41.0], [-123.0, 42.3]]],
    ["Sierra Nevada", 600, 0.45, [[-118.6, 36.0], [-119.6, 37.6], [-120.6, 39.2]]],
    ["Oregon & Washington Cascades", 500, 0.6, [[-121.8, 43.0], [-121.5, 45.2], [-120.8, 47.6]]],
    ["Idaho & western Montana", 600, 0.9, [[-115.5, 44.2], [-114.8, 46.0], [-113.8, 47.6]]],
    ["Arizona & New Mexico", 380, 0.9, [[-111.8, 33.8], [-109.5, 33.8], [-106.2, 35.6]]],
    ["Interior Alaska", 750, 1.6, [[-152, 64.8], [-146, 65.2], [-142, 64.0]]],
    ["Flint Hills prescribed burns (KS–OK)", 650, 0.45, [[-96.6, 36.6], [-96.5, 38.0], [-96.6, 39.2]]],
    ["Southeast prescribed burns", 900, 1.2, [[-91.5, 31.0], [-88.0, 31.2], [-84.5, 31.0], [-82.0, 30.0], [-81.4, 27.6]]],
    ["Southern California chaparral", 250, 0.35, [[-120.0, 34.5], [-118.4, 34.3], [-116.9, 33.2]]],
  ],
  in: [
    ["Punjab & Haryana stubble burning", 1600, 0.55, [[74.6, 31.4], [75.6, 30.6], [76.4, 29.9], [76.9, 29.3]]],
    ["Central India forests (MP & Chhattisgarh)", 900, 1.2, [[78.6, 22.6], [80.6, 22.0], [82.4, 21.2]]],
    ["Odisha & Jharkhand forests", 700, 0.9, [[83.4, 21.0], [84.8, 22.4], [85.4, 23.4]]],
    ["Northeast shifting cultivation", 950, 0.6, [[93.0, 24.0], [92.8, 23.0], [93.9, 25.2], [94.5, 26.2]]],
    ["Eastern Ghats (AP & Telangana)", 500, 0.8, [[79.2, 16.6], [81.0, 17.6], [82.4, 18.6]]],
    ["Uttarakhand & Himachal forests", 350, 0.45, [[77.3, 31.2], [78.6, 30.3], [79.8, 29.6]]],
    ["Western Ghats", 220, 0.4, [[73.8, 17.0], [74.6, 14.6], [76.2, 11.2]]],
  ],
  cn: [
    ["Greater Khingan (Heilongjiang–Inner Mongolia)", 500, 1.0, [[122.0, 49.5], [124.0, 51.5], [125.5, 52.6]]],
    ["Northeast straw burning (Heilongjiang–Jilin)", 1300, 1.0, [[124.0, 44.0], [126.0, 45.8], [128.5, 46.8], [131.5, 47.0]]],
    ["North China Plain straw burning", 900, 1.1, [[114.5, 34.0], [116.5, 35.5], [117.2, 37.6]]],
    ["Yunnan forests", 700, 1.0, [[99.5, 23.5], [100.5, 25.0], [102.5, 25.4]]],
    ["Guangxi & western Guangdong", 600, 1.0, [[106.8, 23.0], [109.0, 23.8], [111.5, 23.4]]],
    ["Sichuan Liangshan", 260, 0.5, [[101.8, 27.4], [102.6, 28.2]]],
    ["Southeast hills (Jiangxi–Fujian–Hunan)", 450, 1.2, [[112.0, 26.5], [115.0, 26.5], [117.5, 25.6]]],
  ],
  au: [
    ["Top End savanna (NT)", 1600, 1.2, [[130.2, -12.6], [132.6, -13.6], [134.8, -14.6], [136.0, -13.0]]],
    ["Kimberley (WA)", 1100, 1.0, [[124.0, -16.4], [126.2, -16.8], [128.4, -16.2]]],
    ["Cape York Peninsula (QLD)", 950, 0.9, [[142.6, -14.0], [143.2, -15.6], [143.8, -12.0]]],
    ["Gulf Country (QLD–NT)", 650, 1.1, [[137.0, -17.4], [139.5, -18.0], [141.4, -17.6]]],
    ["South-east forests (NSW–VIC)", 750, 0.7, [[150.2, -33.4], [149.8, -35.6], [148.6, -37.2], [146.8, -37.6]]],
    ["South-west forests (WA)", 260, 0.5, [[115.9, -33.2], [116.4, -34.2]]],
    ["Pilbara spinifex (WA)", 380, 1.2, [[118.8, -21.8], [121.6, -22.4]]],
  ],
};

// ---------------------------------------------------------- game purchases

/**
 * Modelled launch-month purchases of a blockbuster console game (GTA VI), not real sales data.
 * Buyers are drawn from the population model; the purchase rate depends on the country (console
 * ownership and game prices relative to income) and on the region, and is higher in cities.
 * Mainland China is low because console games have limited official availability there;
 * Hong Kong and Macau are much higher.
 */
const GAME_RATE: Record<CountryId, { perPerson: number; boost: Record<string, number> }> = {
  us: {
    perPerson: 0.04,
    boost: { CA: 1.3, WA: 1.3, NY: 1.15, NJ: 1.2, MA: 1.2, MD: 1.15, TX: 1.15, NV: 1.2, FL: 1.1, GA: 1.1, IL: 1.05, CO: 1.15, MS: 0.7, WV: 0.7, AR: 0.75, ME: 0.8, VT: 0.75 },
  },
  in: {
    perPerson: 0.0011,
    boost: { DL: 4, KA: 3.2, MH: 2.6, TG: 2.6, TN: 1.8, HR: 2.2, CH: 3, KL: 1.6, GJ: 1.3, GA: 2, PB: 1.2, BR: 0.25, UP: 0.45, JH: 0.4, CT: 0.4, OR: 0.45, MP: 0.5, AS: 0.5 },
  },
  cn: {
    perPerson: 0.0004,
    boost: { HK: 70, MO: 50, SH: 4, BJ: 3.5, GD: 2.6, ZJ: 2.2, JS: 1.8, TJ: 1.6, FJ: 1.4, XZ: 0.2, QH: 0.3, GS: 0.35, GZ: 0.4 },
  },
  au: {
    perPerson: 0.045,
    boost: { ACT: 1.25, NSW: 1.1, VIC: 1.1, QLD: 1.0, WA: 1.05, SA: 0.9, TAS: 0.8, NT: 0.85 },
  },
};

function gtaPoints(id: CountryId): PointDatum[] {
  const { perPerson, boost } = GAME_RATE[id];
  const rand = mulberry32(307);
  return populationPoints(id, 24000, 307).map((p) => {
    const rural = p.city.endsWith("(towns & rural)");
    const rate = perPerson * (boost[p.region ?? ""] ?? 1) * (rural ? 0.65 : 1.3) * Math.exp(gaussian(rand) * 0.35);
    return { ...p, value: Math.round(p.value * rate) };
  });
}

// ---------------------------------------------------------------------- datasets

export type DatasetId = "population" | "outages" | "quakes" | "fires" | "gta";

export interface Dataset {
  id: DatasetId;
  label: string;
  blurb: string;
  data: readonly HexDatum[];
  valueLabel: string;
  aggregate: Aggregate;
  palette: PaletteName;
  transform?: "linear" | "sqrt" | "log";
  legendTitle: string;
}

export interface DatasetEntry {
  id: DatasetId;
  label: string;
  palette: PaletteName;
  /** Generates the data on first call, then returns the cached dataset. */
  load: () => Dataset;
}

const cache = new Map<string, Dataset>();
const fmt = (n: number) => n.toLocaleString("en-US");

function lazy(key: string, make: () => Dataset): Dataset {
  let d = cache.get(key);
  if (!d) cache.set(key, (d = make()));
  return d;
}

/** The demo datasets for a country. */
export function getDatasets(id: CountryId): DatasetEntry[] {
  const noun = id === "cn" ? "province" : "state";
  const census = CENSUS_LABEL[id];
  const storm = STORMS[id];
  return [
    {
      id: "population",
      label: "Population",
      palette: "viridis",
      load: () =>
        lazy(`${id}/population`, () => ({
          id: "population",
          label: "Population",
          blurb: `Real ${census} totals per ${noun}, placed in its cities and towns.`,
          data: populationPoints(id, 36000, 7),
          valueLabel: "People",
          aggregate: "sum",
          palette: "viridis",
          transform: "log",
          legendTitle: `Population (${census})`,
        })),
    },
    {
      id: "outages",
      label: `${storm.name} outages`,
      palette: "heat",
      load: () =>
        lazy(`${id}/outages`, () => {
          const data = outagePoints(id);
          const customers = data.reduce((a, d) => a + d.value, 0);
          return {
            id: "outages",
            label: `${storm.name} outages`,
            blurb: `Scenario: ${storm.blurb} About ${fmt(Math.round(customers / 10000) * 10000)} customers lose power.`,
            data,
            valueLabel: "Customers out",
            aggregate: "sum",
            palette: "heat",
            transform: "sqrt",
            legendTitle: "Customers without power",
          };
        }),
    },
    {
      id: "quakes",
      label: "Earthquakes",
      palette: "magma",
      load: () =>
        lazy(`${id}/quakes`, () => {
          const data = zonePoints(id, QUAKE_ZONES[id], 31, magnitude);
          const big = data.filter((d) => d.value >= 5).length;
          return {
            id: "quakes",
            label: "Earthquakes",
            blurb: `${fmt(data.length)} quakes of M2.5+ (${big} of M5+) on the country's real fault zones. Modelled.`,
            data,
            valueLabel: "Earthquakes",
            aggregate: "count",
            palette: "magma",
            transform: "log",
            legendTitle: "Earthquakes, M2.5+",
          };
        }),
    },
    {
      id: "fires",
      label: "Wildfire hotspots",
      palette: "plasma",
      load: () =>
        lazy(`${id}/fires`, () => {
          const data = zonePoints(id, FIRE_ZONES[id], 41, (r) => Math.round(5 + -Math.log(1 - r()) * 25), 45);
          return {
            id: "fires",
            label: "Wildfire hotspots",
            blurb: `${fmt(data.length)} satellite fire detections over a season, in the regions that burn most. Modelled.`,
            data,
            valueLabel: "Hotspots",
            aggregate: "count",
            palette: "plasma",
            transform: "sqrt",
            legendTitle: "Fire hotspots",
          };
        }),
    },
    {
      id: "gta",
      label: "GTA VI purchases",
      palette: "purples",
      load: () =>
        lazy(`${id}/gta`, () => {
          const data = gtaPoints(id);
          const total = data.reduce((a, d) => a + d.value, 0);
          return {
            id: "gta",
            label: "GTA VI purchases",
            blurb: `~${fmt(Math.round(total / 10000) * 10000)} copies in launch month, by where buyers live. Modelled, not real sales data.`,
            data,
            valueLabel: "Copies sold",
            aggregate: "sum",
            palette: "purples",
            transform: "log",
            legendTitle: "GTA VI copies (modelled)",
          };
        }),
    },
  ];
}

/** Real census population per region as `{ state, value }` records (value in people). */
export function censusRecords(id: CountryId): Array<{ state: string; value: number }> {
  return Object.entries(POPULATION[id]).map(([state, millions]) => ({ state, value: Math.round(millions * 1e6) }));
}

export const censusLabel = (id: CountryId) => CENSUS_LABEL[id];
