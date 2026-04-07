import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import MapView, {Marker, Polyline, Polygon, PROVIDER_DEFAULT} from 'react-native-maps';
import {useDeviceStore} from '../store/useDeviceStore';
import {useProjectStore} from '../store/useProjectStore';
import {fixTypeColor} from '../lib/formats';
import {BUILT_IN_CODES} from '../lib/code-library';
import {GnssStatusBar} from '../components/shared/StatusBar';

export function MapScreen() {
  const fix = useDeviceStore(s => s.liveFix);
  const points = useProjectStore(s => s.points);
  const hasPosition = fix.latitude !== 0 && fix.longitude !== 0;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        showsUserLocation={false}
        showsCompass
        showsScale
        initialRegion={{
          latitude: hasPosition ? fix.latitude : 41.39,
          longitude: hasPosition ? fix.longitude : 2.17,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        region={
          hasPosition
            ? {
                latitude: fix.latitude,
                longitude: fix.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }
            : undefined
        }>
        {/* Rover position */}
        {hasPosition && (
          <Marker
            coordinate={{latitude: fix.latitude, longitude: fix.longitude}}
            anchor={{x: 0.5, y: 0.5}}>
            <View
              style={[
                styles.roverMarker,
                {backgroundColor: fixTypeColor(fix.fixQuality)},
              ]}
            />
          </Marker>
        )}

        {/* Collected points */}
        {points.map(pt => {
          const codeObj = BUILT_IN_CODES.find(c => c.id === pt.code);
          const color = codeObj?.color || '#8b5cf6';
          return (
            <Marker
              key={pt.id}
              coordinate={{latitude: pt.latitude, longitude: pt.longitude}}
              anchor={{x: 0.5, y: 0.5}}
              title={pt.name}
              description={`${pt.code} — ${pt.fixType}`}>
              <View style={[styles.pointMarker, {backgroundColor: color}]} />
            </Marker>
          );
        })}
      </MapView>
      <GnssStatusBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  map: {
    flex: 1,
  },
  roverMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: 'white',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  pointMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
});
