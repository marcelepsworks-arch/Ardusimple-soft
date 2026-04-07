import {parseSentence, emptyFix, generateGGA, LiveFix} from '../src/lib/nmea-parser';

describe('NMEA Parser', () => {
  let fix: LiveFix;

  beforeEach(() => {
    fix = emptyFix();
  });

  describe('GGA parsing', () => {
    test('parses valid GGA sentence with RTK Fix', () => {
      // Real-world GGA: Barcelona area, RTK Fix (quality=4), 12 sats
      const sentence =
        '$GNGGA,120000.00,4123.4567,N,00212.3456,E,4,12,0.8,123.4,M,47.0,M,1.2,0000*';
      // Compute checksum
      const body = sentence.substring(1, sentence.lastIndexOf('*'));
      let cs = 0;
      for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
      const full = sentence + cs.toString(16).toUpperCase().padStart(2, '0');

      const result = parseSentence(full, fix);
      expect(result).toBe(true);
      expect(fix.fixQuality).toBe(4);
      expect(fix.fixType).toBe('RTK Fix');
      expect(fix.satsUsed).toBe(12);
      expect(fix.hdop).toBeCloseTo(0.8, 1);
      expect(fix.altitude).toBeCloseTo(123.4, 1);
      expect(fix.latitude).toBeCloseTo(41.3909, 3);
      expect(fix.longitude).toBeCloseTo(2.2057, 3);
      expect(fix.ageOfCorrections).toBeCloseTo(1.2, 1);
    });

    test('parses GGA with no fix (quality=0)', () => {
      const sentence = '$GPGGA,,,,,,,0,0,99.9,,M,,M,,*';
      const body = sentence.substring(1, sentence.lastIndexOf('*'));
      let cs = 0;
      for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
      const full = sentence + cs.toString(16).toUpperCase().padStart(2, '0');

      parseSentence(full, fix);
      expect(fix.fixQuality).toBe(0);
      expect(fix.fixType).toBe('No Fix');
    });

    test('rejects sentence with bad checksum', () => {
      const sentence = '$GPGGA,120000.00,4123.4567,N,00212.3456,E,1,8,0.9,50.0,M,47.0,M,,*FF';
      const result = parseSentence(sentence, fix);
      expect(result).toBe(false);
    });

    test('rejects too-short sentence', () => {
      expect(parseSentence('$GP', fix)).toBe(false);
    });

    test('rejects non-$ sentence', () => {
      expect(parseSentence('hello world', fix)).toBe(false);
    });
  });

  describe('RMC parsing', () => {
    test('parses speed and course from RMC', () => {
      const sentence =
        '$GNRMC,120000.00,A,4123.4567,N,00212.3456,E,5.2,123.4,070426,,,A,V*';
      const body = sentence.substring(1, sentence.lastIndexOf('*'));
      let cs = 0;
      for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
      const full = sentence + cs.toString(16).toUpperCase().padStart(2, '0');

      const result = parseSentence(full, fix);
      expect(result).toBe(true);
      expect(fix.speedKnots).toBeCloseTo(5.2, 1);
      expect(fix.course).toBeCloseTo(123.4, 1);
    });
  });

  describe('GGA generation', () => {
    test('generates valid GGA string', () => {
      fix.latitude = 41.3909;
      fix.longitude = 2.2057;
      fix.altitude = 123.4;
      fix.fixQuality = 4;
      fix.satsUsed = 12;
      fix.hdop = 0.8;
      fix.timestamp = '120000.00';

      const gga = generateGGA(fix);
      expect(gga).toMatch(/^\$GPGGA,/);
      expect(gga).toMatch(/\*[0-9A-F]{2}\r\n$/);
      // Verify checksum
      const body = gga.substring(1, gga.lastIndexOf('*'));
      const stated = gga.substring(gga.lastIndexOf('*') + 1).trim();
      let cs = 0;
      for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
      expect(cs.toString(16).toUpperCase().padStart(2, '0')).toBe(stated);
    });

    test('handles southern hemisphere', () => {
      fix.latitude = -33.8688;
      fix.longitude = 151.2093;
      fix.timestamp = '000000.00';
      const gga = generateGGA(fix);
      expect(gga).toContain(',S,');
      expect(gga).toContain(',E,');
    });
  });

  describe('coordinate parsing edge cases', () => {
    test('handles west longitude', () => {
      const sentence =
        '$GPGGA,120000.00,4000.0000,N,07400.0000,W,1,8,1.0,50.0,M,0.0,M,,*';
      const body = sentence.substring(1, sentence.lastIndexOf('*'));
      let cs = 0;
      for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
      const full = sentence + cs.toString(16).toUpperCase().padStart(2, '0');

      parseSentence(full, fix);
      expect(fix.latitude).toBeCloseTo(40.0, 2);
      expect(fix.longitude).toBeCloseTo(-74.0, 2);
    });
  });
});
