/**
 * Coordinate system engine using proj4.
 *
 * Bundles the most common EPSG codes used in surveying.
 * Users can also enter a custom proj4 string.
 */

import proj4 from 'proj4';

export interface CoordinateSystem {
  epsg: number;
  name: string;
  country: string;
  proj4def: string;
}

/** Register all bundled coordinate systems with proj4 */
export function registerAllCS(): void {
  COORDINATE_SYSTEMS.forEach(cs => {
    proj4.defs(`EPSG:${cs.epsg}`, cs.proj4def);
  });
}

/** Transform WGS84 (lon, lat) to project CS (easting, northing) */
export function wgs84ToProject(
  lon: number,
  lat: number,
  epsg: number,
): {easting: number; northing: number} {
  const result = proj4('EPSG:4326', `EPSG:${epsg}`, [lon, lat]);
  return {easting: result[0], northing: result[1]};
}

/** Transform project CS (easting, northing) back to WGS84 (lon, lat) */
export function projectToWgs84(
  easting: number,
  northing: number,
  epsg: number,
): {longitude: number; latitude: number} {
  const result = proj4(`EPSG:${epsg}`, 'EPSG:4326', [easting, northing]);
  return {longitude: result[0], latitude: result[1]};
}

/** Register a custom proj4 definition */
export function registerCustomCS(epsg: number, proj4def: string): void {
  proj4.defs(`EPSG:${epsg}`, proj4def);
}

/** Search coordinate systems by name, country, or EPSG code */
export function searchCS(query: string): CoordinateSystem[] {
  const q = query.toLowerCase();
  return COORDINATE_SYSTEMS.filter(
    cs =>
      cs.name.toLowerCase().includes(q) ||
      cs.country.toLowerCase().includes(q) ||
      cs.epsg.toString().includes(q),
  );
}

/**
 * Bundled coordinate systems — top 50 most used in surveying worldwide.
 * Covers Europe, Americas, Asia-Pacific, and Africa.
 */
export const COORDINATE_SYSTEMS: CoordinateSystem[] = [
  // --- WGS84 ---
  {epsg: 4326, name: 'WGS 84 (Geographic)', country: 'World', proj4def: '+proj=longlat +datum=WGS84 +no_defs'},

  // --- UTM Zones (WGS84) ---
  {epsg: 32629, name: 'WGS 84 / UTM zone 29N', country: 'World', proj4def: '+proj=utm +zone=29 +datum=WGS84 +units=m +no_defs'},
  {epsg: 32630, name: 'WGS 84 / UTM zone 30N', country: 'World', proj4def: '+proj=utm +zone=30 +datum=WGS84 +units=m +no_defs'},
  {epsg: 32631, name: 'WGS 84 / UTM zone 31N', country: 'World', proj4def: '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs'},
  {epsg: 32632, name: 'WGS 84 / UTM zone 32N', country: 'World', proj4def: '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs'},
  {epsg: 32633, name: 'WGS 84 / UTM zone 33N', country: 'World', proj4def: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs'},

  // --- Spain ---
  {epsg: 25830, name: 'ETRS89 / UTM zone 30N', country: 'Spain', proj4def: '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},
  {epsg: 25831, name: 'ETRS89 / UTM zone 31N', country: 'Spain', proj4def: '+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- France ---
  {epsg: 2154, name: 'RGF93 v1 / Lambert-93', country: 'France', proj4def: '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- Germany ---
  {epsg: 25832, name: 'ETRS89 / UTM zone 32N', country: 'Germany', proj4def: '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},
  {epsg: 25833, name: 'ETRS89 / UTM zone 33N', country: 'Germany', proj4def: '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- UK ---
  {epsg: 27700, name: 'OSGB 1936 / British National Grid', country: 'UK', proj4def: '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs'},

  // --- Italy ---
  {epsg: 6707, name: 'RDN2008 / UTM zone 32N', country: 'Italy', proj4def: '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},
  {epsg: 6708, name: 'RDN2008 / UTM zone 33N', country: 'Italy', proj4def: '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- Switzerland ---
  {epsg: 2056, name: 'CH1903+ / LV95', country: 'Switzerland', proj4def: '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'},

  // --- Netherlands ---
  {epsg: 28992, name: 'Amersfoort / RD New', country: 'Netherlands', proj4def: '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs'},

  // --- Belgium ---
  {epsg: 31370, name: 'Belge 1972 / Belgian Lambert 72', country: 'Belgium', proj4def: '+proj=lcc +lat_0=90 +lon_0=4.36748666666667 +lat_1=51.1666723333333 +lat_2=49.8333339 +x_0=150000.013 +y_0=5400088.438 +ellps=intl +towgs84=-106.869,52.2978,-103.724,0.3366,-0.457,1.8422,-1.2747 +units=m +no_defs'},

  // --- Portugal ---
  {epsg: 3763, name: 'ETRS89 / Portugal TM06', country: 'Portugal', proj4def: '+proj=tmerc +lat_0=39.6682583333333 +lon_0=-8.13310833333333 +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- USA ---
  {epsg: 2229, name: 'NAD83 / California zone 5 (ftUS)', country: 'USA', proj4def: '+proj=lcc +lat_0=33.5 +lon_0=-118 +lat_1=35.4666666666667 +lat_2=34.0333333333333 +x_0=2000000.0001016 +y_0=500000.0001016 +datum=NAD83 +units=us-ft +no_defs'},
  {epsg: 32617, name: 'WGS 84 / UTM zone 17N', country: 'USA', proj4def: '+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs'},
  {epsg: 32618, name: 'WGS 84 / UTM zone 18N', country: 'USA', proj4def: '+proj=utm +zone=18 +datum=WGS84 +units=m +no_defs'},
  {epsg: 2264, name: 'NAD83 / North Carolina (ftUS)', country: 'USA', proj4def: '+proj=lcc +lat_0=33.75 +lon_0=-79 +lat_1=36.1666666666667 +lat_2=34.3333333333333 +x_0=609601.2192024384 +y_0=0 +datum=NAD83 +units=us-ft +no_defs'},

  // --- Canada ---
  {epsg: 2958, name: 'NAD83(CSRS) / UTM zone 17N', country: 'Canada', proj4def: '+proj=utm +zone=17 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- Australia ---
  {epsg: 28354, name: 'GDA94 / MGA zone 54', country: 'Australia', proj4def: '+proj=utm +zone=54 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},
  {epsg: 28355, name: 'GDA94 / MGA zone 55', country: 'Australia', proj4def: '+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},
  {epsg: 28356, name: 'GDA94 / MGA zone 56', country: 'Australia', proj4def: '+proj=utm +zone=56 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- Japan ---
  {epsg: 6677, name: 'JGD2011 / Japan Plane Zone IX', country: 'Japan', proj4def: '+proj=tmerc +lat_0=36 +lon_0=139.833333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- Brazil ---
  {epsg: 31983, name: 'SIRGAS 2000 / UTM zone 23S', country: 'Brazil', proj4def: '+proj=utm +zone=23 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- South Africa ---
  {epsg: 2048, name: 'Hartebeesthoek94 / Lo29', country: 'South Africa', proj4def: '+proj=tmerc +lat_0=0 +lon_0=29 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},

  // --- India ---
  {epsg: 32644, name: 'WGS 84 / UTM zone 44N', country: 'India', proj4def: '+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs'},

  // --- Scandinavia ---
  {epsg: 25835, name: 'ETRS89 / UTM zone 35N', country: 'Finland', proj4def: '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},
  {epsg: 3006, name: 'SWEREF99 TM', country: 'Sweden', proj4def: '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},
  {epsg: 25832, name: 'ETRS89 / UTM zone 32N (Norway)', country: 'Norway', proj4def: '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'},
];
