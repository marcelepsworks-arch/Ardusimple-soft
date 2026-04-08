/**
 * Stakeout Screen — navigate to a target point using GNSS position.
 *
 * Shows:
 *  - Target point picker (from collected points in active project or manual entry)
 *  - Distance and bearing to target
 *  - Arrow indicator (compass-style) pointing toward target
 *  - North/East offset display
 *  - Arrival alert when within tolerance
 */

import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
  Vibration,
} from 'react-native';
import {useDeviceStore} from '../store/useDeviceStore';
import {useProjectStore, CollectedPoint} from '../store/useProjectStore';
import {wgs84ToProject} from '../lib/coordinate-systems';

// ─── Geodetic helpers ────────────────────────────────────────────────────────

/** WGS-84 ellipsoid semi-major axis */
const A = 6378137.0;
/** WGS-84 flattening */
const F = 1 / 298.257223563;
const B_AXIS = A * (1 - F);

/** Vincenty inverse: returns distance (m) and forward bearing (deg) */
function vincenty(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): {distance: number; bearing: number} {
  const toRad = (d: number) => (d * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const L = toRad(lon2 - lon1);

  const U1 = Math.atan((1 - F) * Math.tan(φ1));
  const U2 = Math.atan((1 - F) * Math.tan(φ2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let λ = L;
  let λPrev = 0;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let sinAlpha = 0;
  let cos2SigmaM = 0;
  let cosSqAlpha = 0;

  for (let iter = 0; iter < 100; iter++) {
    const sinLambda = Math.sin(λ);
    const cosLambda = Math.cos(λ);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2,
    );
    if (sinSigma === 0) return {distance: 0, bearing: 0}; // coincident points

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha ** 2;
    cos2SigmaM =
      cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;

    const C = (F / 16) * cosSqAlpha * (4 + F * (4 - 3 * cosSqAlpha));
    λPrev = λ;
    λ =
      L +
      (1 - C) *
        F *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));

    if (Math.abs(λ - λPrev) <= 1e-12) break;
  }

  const uSq = (cosSqAlpha * (A ** 2 - B_AXIS ** 2)) / B_AXIS ** 2;
  const capA = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const capB = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    capB *
    sinSigma *
    (cos2SigmaM +
      (capB / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (capB / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));

  const distance = B_AXIS * capA * (sigma - deltaSigma);

  const bearing =
    (Math.atan2(
      cosU2 * Math.sin(λ),
      cosU1 * sinU2 - sinU1 * cosU2 * Math.cos(λ),
    ) *
      180) /
    Math.PI;

  return {distance, bearing: (bearing + 360) % 360};
}

/** Compute North/East offsets in metres between two WGS-84 points */
function neOffsets(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): {north: number; east: number} {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const mPerDegLat = 111132.954 - 559.822 * Math.cos(2 * toRad(lat1)) + 1.175 * Math.cos(4 * toRad(lat1));
  const mPerDegLon = (111412.84 * Math.cos(toRad(lat1))) - (93.5 * Math.cos(3 * toRad(lat1)));
  return {
    north: (lat2 - lat1) * mPerDegLat,
    east: (lon2 - lon1) * mPerDegLon,
  };
}

// ─── Tolerance presets ───────────────────────────────────────────────────────

const TOLERANCES = [0.01, 0.05, 0.10, 0.50, 1.00];

// ─── Component ───────────────────────────────────────────────────────────────

interface TargetPoint {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

export function StakeoutScreen() {
  const {liveFix} = useDeviceStore();
  const {points, activeProject} = useProjectStore();

  const [target, setTarget] = useState<TargetPoint | null>(null);
  const [tolerance, setTolerance] = useState(0.05); // metres
  const [pickerVisible, setPickerVisible] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);

  // Manual entry state
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualName, setManualName] = useState('');

  // Derived stakeout values
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [north, setNorth] = useState<number | null>(null);
  const [east, setEast] = useState<number | null>(null);
  const [arrived, setArrived] = useState(false);

  // Recompute on each new fix or target change
  useEffect(() => {
    if (!target || !liveFix.latitude || !liveFix.longitude) {
      setDistance(null);
      setBearing(null);
      setNorth(null);
      setEast(null);
      return;
    }

    const {distance: d, bearing: b} = vincenty(
      liveFix.latitude,
      liveFix.longitude,
      target.latitude,
      target.longitude,
    );
    const {north: n, east: e} = neOffsets(
      liveFix.latitude,
      liveFix.longitude,
      target.latitude,
      target.longitude,
    );

    setDistance(d);
    setBearing(b);
    setNorth(n);
    setEast(e);

    if (d <= tolerance && !arrived) {
      setArrived(true);
      Vibration.vibrate([0, 200, 100, 200]);
      Alert.alert('Arrived!', `Within ${tolerance * 100} cm of "${target.name}".`);
    } else if (d > tolerance) {
      setArrived(false);
    }
  }, [liveFix, target, tolerance, arrived]);

  const projectPoints = points.filter(p => p.projectId === activeProject?.id);

  function selectPoint(p: CollectedPoint) {
    setTarget({
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      elevation: p.elevation,
    });
    setPickerVisible(false);
    setArrived(false);
  }

  function confirmManual() {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      Alert.alert('Invalid coordinates', 'Enter valid latitude and longitude.');
      return;
    }
    setTarget({
      name: manualName.trim() || 'Manual Target',
      latitude: lat,
      longitude: lon,
      elevation: 0,
    });
    setManualVisible(false);
    setArrived(false);
  }

  // Arrow rotation: bearing from current position to target
  const arrowRotation = bearing !== null ? `${Math.round(bearing)}deg` : '0deg';

  const hasPosition = liveFix.latitude !== 0 && liveFix.longitude !== 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Target selection */}
      <View style={styles.targetCard}>
        <Text style={styles.sectionLabel}>Target Point</Text>
        {target ? (
          <View>
            <Text style={styles.targetName}>{target.name}</Text>
            <Text style={styles.targetCoords}>
              {target.latitude.toFixed(8)}, {target.longitude.toFixed(8)}
            </Text>
          </View>
        ) : (
          <Text style={styles.targetNone}>No target selected</Text>
        )}
        <View style={styles.targetButtons}>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline, {flex: 1}]}
            onPress={() => setPickerVisible(true)}>
            <Text style={styles.btnOutlineText}>From Project</Text>
          </TouchableOpacity>
          <View style={{width: 10}} />
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline, {flex: 1}]}
            onPress={() => setManualVisible(true)}>
            <Text style={styles.btnOutlineText}>Manual Entry</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Compass arrow display */}
      {target && (
        <View style={styles.compassCard}>
          {!hasPosition && (
            <Text style={styles.noFixWarning}>Waiting for GNSS fix…</Text>
          )}
          {hasPosition && distance !== null && (
            <>
              {/* Arrow */}
              <View style={styles.arrowContainer}>
                <View
                  style={[
                    styles.arrow,
                    {transform: [{rotate: arrowRotation}]},
                    arrived && styles.arrowArrived,
                  ]}>
                  <Text style={styles.arrowChar}>↑</Text>
                </View>
              </View>

              {/* Distance */}
              <Text style={[styles.distanceText, arrived && styles.distanceArrived]}>
                {distance < 1
                  ? `${(distance * 100).toFixed(1)} cm`
                  : distance < 100
                  ? `${distance.toFixed(3)} m`
                  : `${distance.toFixed(1)} m`}
              </Text>
              {arrived && <Text style={styles.arrivedLabel}>ON POINT ✓</Text>}

              {/* N/E offsets */}
              <View style={styles.offsetRow}>
                <View style={styles.offsetCell}>
                  <Text style={styles.offsetLabel}>→ North</Text>
                  <Text style={[styles.offsetValue, north! < 0 && styles.negValue]}>
                    {north !== null
                      ? `${north >= 0 ? '+' : ''}${north.toFixed(3)} m`
                      : '—'}
                  </Text>
                </View>
                <View style={styles.offsetCell}>
                  <Text style={styles.offsetLabel}>→ East</Text>
                  <Text style={[styles.offsetValue, east! < 0 && styles.negValue]}>
                    {east !== null
                      ? `${east >= 0 ? '+' : ''}${east.toFixed(3)} m`
                      : '—'}
                  </Text>
                </View>
              </View>

              {/* Bearing */}
              <Text style={styles.bearingText}>
                Bearing: {bearing !== null ? `${bearing.toFixed(1)}°` : '—'}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Tolerance picker */}
      <Text style={styles.sectionLabel}>Arrival Tolerance</Text>
      <View style={styles.toleranceRow}>
        {TOLERANCES.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tolBtn, tolerance === t && styles.tolBtnActive]}
            onPress={() => setTolerance(t)}>
            <Text style={[styles.tolText, tolerance === t && styles.tolTextActive]}>
              {t < 0.1 ? `${(t * 100).toFixed(0)} cm` : `${t.toFixed(2)} m`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Current position */}
      <View style={styles.posCard}>
        <Text style={styles.sectionLabel}>Current Position</Text>
        <Text style={styles.posText}>
          {hasPosition
            ? `${liveFix.latitude.toFixed(8)}, ${liveFix.longitude.toFixed(8)}`
            : 'No fix'}
        </Text>
        <Text style={styles.posFixType}>
          Fix: {liveFix.fixType || 'None'} · HDOP: {liveFix.hdop.toFixed(1)} · Sats: {liveFix.satsUsed}
        </Text>
      </View>

      {/* Point picker modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Target Point</Text>
            {projectPoints.length === 0 ? (
              <Text style={styles.emptyText}>No points in active project</Text>
            ) : (
              <FlatList
                data={projectPoints}
                keyExtractor={item => item.id}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.pickerRow}
                    onPress={() => selectPoint(item)}>
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <Text style={styles.pickerCoords}>
                      {item.easting.toFixed(3)} E, {item.northing.toFixed(3)} N
                    </Text>
                    <Text style={styles.pickerCode}>{item.code || '—'}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline, {marginTop: 12}]}
              onPress={() => setPickerVisible(false)}>
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual entry modal */}
      <Modal visible={manualVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Manual Target Entry</Text>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={manualName}
              onChangeText={setManualName}
              placeholder="Target name"
              placeholderTextColor="#4b5563"
            />
            <Text style={styles.inputLabel}>Latitude (decimal degrees)</Text>
            <TextInput
              style={styles.input}
              value={manualLat}
              onChangeText={setManualLat}
              keyboardType="numeric"
              placeholder="41.38500000"
              placeholderTextColor="#4b5563"
            />
            <Text style={styles.inputLabel}>Longitude (decimal degrees)</Text>
            <TextInput
              style={styles.input}
              value={manualLon}
              onChangeText={setManualLon}
              keyboardType="numeric"
              placeholder="2.17300000"
              placeholderTextColor="#4b5563"
            />
            <View style={styles.targetButtons}>
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, {flex: 1}]}
                onPress={() => setManualVisible(false)}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <View style={{width: 10}} />
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, {flex: 1}]}
                onPress={confirmManual}>
                <Text style={styles.btnText}>Set Target</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},
  content: {padding: 16, paddingBottom: 40},

  sectionLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  targetCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  targetName: {fontSize: 17, fontWeight: '700', color: '#e5e7eb'},
  targetCoords: {fontSize: 11, color: '#6b7280', marginTop: 2},
  targetNone: {fontSize: 14, color: '#4b5563', fontStyle: 'italic', marginBottom: 10},
  targetButtons: {flexDirection: 'row', marginTop: 12},

  compassCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  noFixWarning: {color: '#f59e0b', fontSize: 13},
  arrowContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#374151',
  },
  arrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowArrived: {},
  arrowChar: {
    fontSize: 72,
    color: '#3b82f6',
    lineHeight: 80,
  },
  distanceText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  distanceArrived: {color: '#22c55e'},
  arrivedLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  offsetRow: {flexDirection: 'row', gap: 16, marginTop: 12, marginBottom: 8},
  offsetCell: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  offsetLabel: {fontSize: 11, color: '#6b7280', marginBottom: 4},
  offsetValue: {fontSize: 15, fontWeight: '700', color: '#e5e7eb'},
  negValue: {color: '#f87171'},

  bearingText: {fontSize: 12, color: '#6b7280', marginTop: 4},

  toleranceRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20},
  tolBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  tolBtnActive: {borderColor: '#3b82f6', backgroundColor: '#1e3a5f'},
  tolText: {fontSize: 12, color: '#9ca3af'},
  tolTextActive: {color: '#60a5fa', fontWeight: '700'},

  posCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  posText: {fontSize: 13, color: '#e5e7eb', fontFamily: 'monospace'},
  posFixType: {fontSize: 11, color: '#6b7280', marginTop: 4},

  btn: {borderRadius: 8, padding: 12, alignItems: 'center'},
  btnPrimary: {backgroundColor: '#3b82f6'},
  btnOutline: {
    borderWidth: 1.5,
    borderColor: '#374151',
    backgroundColor: 'transparent',
  },
  btnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  btnOutlineText: {color: '#9ca3af', fontWeight: '600', fontSize: 14},

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 16,
  },
  emptyText: {color: '#4b5563', textAlign: 'center', marginVertical: 20},
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  pickerName: {fontSize: 14, fontWeight: '600', color: '#e5e7eb'},
  pickerCoords: {fontSize: 11, color: '#6b7280', marginTop: 2},
  pickerCode: {fontSize: 11, color: '#3b82f6', marginTop: 1},

  inputLabel: {fontSize: 12, color: '#6b7280', marginBottom: 4, marginTop: 10},
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 10,
    color: '#e5e7eb',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
});
