import { US_GEOMETRY } from "./geo/us";
import { decodeGeometry } from "./encoding";
import type { Country, CountryGeometry, RegionInfo } from "./types";

let geometry: CountryGeometry | undefined;

export const US_STATES: RegionInfo[] = [
  ["01", "AL", "Alabama"], ["02", "AK", "Alaska"], ["04", "AZ", "Arizona"], ["05", "AR", "Arkansas"],
  ["06", "CA", "California"], ["08", "CO", "Colorado"], ["09", "CT", "Connecticut"], ["10", "DE", "Delaware"],
  ["11", "DC", "District of Columbia"], ["12", "FL", "Florida"], ["13", "GA", "Georgia"], ["15", "HI", "Hawaii"],
  ["16", "ID", "Idaho"], ["17", "IL", "Illinois"], ["18", "IN", "Indiana"], ["19", "IA", "Iowa"],
  ["20", "KS", "Kansas"], ["21", "KY", "Kentucky"], ["22", "LA", "Louisiana"], ["23", "ME", "Maine"],
  ["24", "MD", "Maryland"], ["25", "MA", "Massachusetts"], ["26", "MI", "Michigan"], ["27", "MN", "Minnesota"],
  ["28", "MS", "Mississippi"], ["29", "MO", "Missouri"], ["30", "MT", "Montana"], ["31", "NE", "Nebraska"],
  ["32", "NV", "Nevada"], ["33", "NH", "New Hampshire"], ["34", "NJ", "New Jersey"], ["35", "NM", "New Mexico"],
  ["36", "NY", "New York"], ["37", "NC", "North Carolina"], ["38", "ND", "North Dakota"], ["39", "OH", "Ohio"],
  ["40", "OK", "Oklahoma"], ["41", "OR", "Oregon"], ["42", "PA", "Pennsylvania"], ["44", "RI", "Rhode Island"],
  ["45", "SC", "South Carolina"], ["46", "SD", "South Dakota"], ["47", "TN", "Tennessee"], ["48", "TX", "Texas"],
  ["49", "UT", "Utah"], ["50", "VT", "Vermont"], ["51", "VA", "Virginia"], ["53", "WA", "Washington"],
  ["54", "WV", "West Virginia"], ["55", "WI", "Wisconsin"], ["56", "WY", "Wyoming"],
].map(([id, code, name]) => ({ id: id!, code: code!, name: name! }));

/** The 50 states and DC (Albers USA projection with Alaska and Hawaii insets). */
export const USA: Country = {
  id: "us",
  name: "United States",
  regionNoun: "State",
  regions: US_STATES,
  // Decoded on first use, so importing a country costs nothing until a map draws it.
  get geometry(): CountryGeometry {
    return (geometry ??= decodeGeometry(US_GEOMETRY));
  },
  tileLayout: {
    AK: [0, 0], ME: [10, 0],
    VT: [8, 1], NH: [9, 1],
    WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], WI: [5, 2], MI: [6, 2], NY: [8, 2], MA: [9, 2],
    OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IL: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3], RI: [11, 3],
    CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
    AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
    OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
    HI: [0, 7], TX: [3, 7], FL: [7, 7],
  },
};
