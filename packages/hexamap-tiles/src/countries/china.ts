import { CN_GEOMETRY, CN_REGIONS } from "./geo/cn";
import { decodeGeometry } from "./encoding";
import type { Country, CountryGeometry } from "./types";

let geometry: CountryGeometry | undefined;

/**
 * Mainland China's 31 provinces, autonomous regions and municipalities, plus Hong Kong
 * and Macau. Natural Earth boundaries; Taiwan and the South China Sea islands are not included.
 */
export const CHINA: Country = {
  id: "cn",
  name: "China",
  regionNoun: "Province",
  regions: CN_REGIONS,
  // Decoded on first use, so importing a country costs nothing until a map draws it.
  get geometry(): CountryGeometry {
    return (geometry ??= decodeGeometry(CN_GEOMETRY));
  },
  tileLayout: {
    NM: [3, 1], BJ: [4, 1], HL: [6, 1],
    NX: [3, 2], HE: [4, 2], LN: [5, 2], JL: [6, 2],
    XJ: [0, 3], QH: [1, 3], GS: [2, 3], SX: [3, 3], TJ: [4, 3], SD: [5, 3],
    XZ: [1, 4], SC: [2, 4], SN: [3, 4], HA: [4, 4], AH: [5, 4], JS: [6, 4],
    CQ: [2, 5], HB: [3, 5], JX: [4, 5], ZJ: [5, 5], SH: [6, 5],
    YN: [2, 6], GZ: [3, 6], HN: [4, 6], GD: [5, 6], FJ: [6, 6],
    GX: [2, 7], MO: [4, 7], HK: [5, 7],
    HI: [3, 8],
  },
};
