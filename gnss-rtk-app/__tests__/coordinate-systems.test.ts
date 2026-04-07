import {
  registerAllCS,
  wgs84ToProject,
  projectToWgs84,
  searchCS,
  COORDINATE_SYSTEMS,
} from '../src/lib/coordinate-systems';

// Register all CS definitions before tests
beforeAll(() => {
  registerAllCS();
});

describe('Coordinate Systems', () => {
  test('COORDINATE_SYSTEMS has 30+ entries', () => {
    expect(COORDINATE_SYSTEMS.length).toBeGreaterThanOrEqual(30);
  });

  test('all entries have required fields', () => {
    for (const cs of COORDINATE_SYSTEMS) {
      expect(cs.epsg).toBeGreaterThan(0);
      expect(cs.name.length).toBeGreaterThan(0);
      expect(cs.proj4def.length).toBeGreaterThan(0);
    }
  });

  describe('WGS84 to ETRS89 / UTM zone 31N (EPSG:25831)', () => {
    test('Barcelona: 41.39°N, 2.17°E → ~430xxx E, ~4583xxx N', () => {
      const {easting, northing} = wgs84ToProject(2.17, 41.39, 25831);
      expect(easting).toBeGreaterThan(400000);
      expect(easting).toBeLessThan(500000);
      expect(northing).toBeGreaterThan(4500000);
      expect(northing).toBeLessThan(4700000);
    });

    test('round-trip preserves coordinates', () => {
      const lon = 2.17, lat = 41.39;
      const {easting, northing} = wgs84ToProject(lon, lat, 25831);
      const {longitude, latitude} = projectToWgs84(easting, northing, 25831);
      expect(longitude).toBeCloseTo(lon, 5);
      expect(latitude).toBeCloseTo(lat, 5);
    });
  });

  describe('WGS84 to RGF93 / Lambert-93 (EPSG:2154)', () => {
    test('Paris: 48.8566°N, 2.3522°E → ~652xxx E, ~6862xxx N', () => {
      const {easting, northing} = wgs84ToProject(2.3522, 48.8566, 2154);
      expect(easting).toBeGreaterThan(600000);
      expect(easting).toBeLessThan(700000);
      expect(northing).toBeGreaterThan(6800000);
      expect(northing).toBeLessThan(6900000);
    });
  });

  describe('WGS84 to British National Grid (EPSG:27700)', () => {
    test('London: 51.5074°N, -0.1278°W → ~530xxx E, ~180xxx N', () => {
      const {easting, northing} = wgs84ToProject(-0.1278, 51.5074, 27700);
      expect(easting).toBeGreaterThan(500000);
      expect(easting).toBeLessThan(560000);
      expect(northing).toBeGreaterThan(170000);
      expect(northing).toBeLessThan(190000);
    });
  });

  describe('searchCS', () => {
    test('search by country "Spain" returns results', () => {
      const results = searchCS('Spain');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => expect(r.country).toBe('Spain'));
    });

    test('search by EPSG "2154" returns Lambert-93', () => {
      const results = searchCS('2154');
      expect(results.length).toBe(1);
      expect(results[0].name).toContain('Lambert-93');
    });

    test('search by name "UTM" returns multiple results', () => {
      const results = searchCS('UTM');
      expect(results.length).toBeGreaterThan(5);
    });

    test('search returns empty for nonsense', () => {
      const results = searchCS('xyzzy12345');
      expect(results.length).toBe(0);
    });
  });
});
