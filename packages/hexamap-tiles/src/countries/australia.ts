import { AU_GEOMETRY, AU_REGIONS } from "./geo/au";
import { decodeGeometry } from "./encoding";
import type { Country, CountryGeometry } from "./types";

let geometry: CountryGeometry | undefined;

/** Australia's 6 states and 3 mainland territories (including Jervis Bay). */
export const AUSTRALIA: Country = {
  id: "au",
  name: "Australia",
  regionNoun: "State",
  regions: AU_REGIONS,
  // Decoded on first use, so importing a country costs nothing until a map draws it.
  get geometry(): CountryGeometry {
    return (geometry ??= decodeGeometry(AU_GEOMETRY));
  },
  tileLayout: {
    NT: [1, 0], QLD: [2, 0],
    WA: [0, 1], SA: [1, 1], NSW: [2, 1], JBT: [3, 1],
    VIC: [2, 2], ACT: [3, 2],
    TAS: [2, 3],
  },
};
