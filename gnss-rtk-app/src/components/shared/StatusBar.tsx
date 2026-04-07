import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useDeviceStore} from '../../store/useDeviceStore';
import {useProjectStore} from '../../store/useProjectStore';
import {formatCoord, fixTypeColor} from '../../lib/formats';
import {wgs84ToProject} from '../../lib/coordinate-systems';

export function GnssStatusBar() {
  const fix = useDeviceStore(s => s.liveFix);
  const connState = useDeviceStore(s => s.connectionState);
  const activeProject = useProjectStore(s => s.activeProject);

  const connColor =
    connState === 'connected'
      ? '#22c55e'
      : connState === 'error'
        ? '#ef4444'
        : '#6b7280';

  // Compute projected coordinates if project is active
  let projected: {easting: number; northing: number} | null = null;
  if (activeProject && fix.latitude !== 0 && fix.longitude !== 0) {
    try {
      projected = wgs84ToProject(
        fix.longitude,
        fix.latitude,
        activeProject.csEpsg,
      );
    } catch {
      // CS not registered or invalid
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.dot, {backgroundColor: connColor}]} />
        <Text
          style={[
            styles.badge,
            {
              backgroundColor: fixTypeColor(fix.fixQuality) + '33',
              color: fixTypeColor(fix.fixQuality),
            },
          ]}>
          {fix.fixType}
        </Text>
        <Text style={styles.text}>Sats: {fix.satsUsed}</Text>
        <Text style={styles.text}>HDOP: {fix.hdop.toFixed(1)}</Text>
        {fix.ageOfCorrections > 0 && (
          <Text style={styles.text}>
            Age: {fix.ageOfCorrections.toFixed(1)}s
          </Text>
        )}
      </View>
      {fix.latitude !== 0 && (
        <View style={styles.row}>
          {projected ? (
            <>
              <Text style={styles.coord}>
                E: {projected.easting.toFixed(3)}
              </Text>
              <Text style={styles.coord}>
                N: {projected.northing.toFixed(3)}
              </Text>
              <Text style={styles.coord}>
                Z: {fix.altitude.toFixed(3)}m
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.coord}>
                {formatCoord(fix.latitude, true)}
              </Text>
              <Text style={styles.coord}>
                {formatCoord(fix.longitude, false)}
              </Text>
              <Text style={styles.coord}>
                Alt: {fix.altitude.toFixed(2)}m
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  text: {
    color: '#9ca3af',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  coord: {
    color: '#d1d5db',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
