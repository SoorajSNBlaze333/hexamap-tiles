import { IN_GEOMETRY, IN_REGIONS } from "./geo/in";
import { decodeGeometry } from "./encoding";
import type { Country, CountryGeometry } from "./types";

let geometry: CountryGeometry | undefined;

/**
 * India's 28 states and 8 union territories.
 *
 * Drawn with India's official boundary: Jammu & Kashmir includes Pakistan-administered Kashmir,
 * and Ladakh includes Gilgit-Baltistan and Aksai Chin (as on the 2019 official map).
 */
export const INDIA: Country = {
  id: "in",
  name: "India",
  regionNoun: "State",
  regions: IN_REGIONS,
  // Decoded on first use, so importing a country costs nothing until a map draws it.
  get geometry(): CountryGeometry {
    return (geometry ??= decodeGeometry(IN_GEOMETRY));
  },
  tileLayout: {
    JK: [1, 0], LA: [2, 0],
    PB: [0, 1], HP: [1, 1], UT: [2, 1],
    CH: [1, 2], HR: [2, 2], SK: [4, 2], AR: [6, 2],
    RJ: [0, 3], DL: [1, 3], UP: [2, 3], BR: [3, 3], ML: [4, 3], AS: [5, 3], NL: [6, 3],
    GJ: [0, 4], MP: [1, 4], CT: [2, 4], JH: [3, 4], WB: [4, 4], TR: [5, 4], MN: [6, 4],
    DH: [0, 5], MH: [1, 5], TG: [2, 5], OR: [3, 5], MZ: [5, 5],
    GA: [0, 6], KA: [1, 6], AP: [2, 6], AN: [6, 6],
    LD: [0, 7], KL: [1, 7], TN: [2, 7], PY: [3, 7],
  },
};
