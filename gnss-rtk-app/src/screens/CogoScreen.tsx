/**
 * COGO Screen — Coordinate Geometry tools.
 *
 * Tools:
 *  1. Inverse        — bearing + distance between two points
 *  2. Traverse       — compute point from start + bearing + distance
 *  3. Area           — polygon area from selected/entered points
 *  4. Intersection   — bearing-bearing or distance-distance
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
  Modal,
} from 'react-native';
import {
  inverse,
  traverseLeg,
  openTraverse,
  polygonArea,
  bearingBearingIntersection,
  distanceDistanceIntersection,
  bearingToQuadrant,
  Point2D,
} from '../lib/cogo';
import {useProjectStore, CollectedPoint} from '../store/useProjectStore';

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tool = 'inverse' | 'traverse' | 'area' | 'intersection';

const TOOLS: {key: Tool; label: string; icon: string}[] = [
  {key: 'inverse', label: 'Inverse', icon: '📐'},
  {key: 'traverse', label: 'Traverse', icon: '🔄'},
  {key: 'area', label: 'Area', icon: '⬡'},
  {key: 'intersection', label: 'Intersect', icon: '✖️'},
];

// ─── Point picker helper ──────────────────────────────────────────────────────

interface PointPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (p: CollectedPoint) => void;
}

function PointPickerModal({visible, onClose, onSelect}: PointPickerProps) {
  const {points, activeProject} = useProjectStore();
  const projectPoints = points.filter(p => p.projectId === activeProject?.id);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Pick Point</Text>
          {projectPoints.length === 0 ? (
            <Text style={styles.emptyText}>No points in active project</Text>
          ) : (
            <FlatList
              data={projectPoints}
              keyExtractor={item => item.id}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.pickerRow} onPress={() => onSelect(item)}>
                  <Text style={styles.pickerName}>{item.name}</Text>
                  <Text style={styles.pickerCoords}>
                    E {item.easting.toFixed(3)}  N {item.northing.toFixed(3)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
          <TouchableOpacity style={[styles.btn, styles.btnOutline, {marginTop: 12}]} onPress={onClose}>
            <Text style={styles.btnOutlineText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Point input row ──────────────────────────────────────────────────────────

interface PointInputProps {
  label: string;
  point: {e: string; n: string; name: string};
  onChange: (f: {e: string; n: string; name: string}) => void;
  onPick: () => void;
}

function PointInput({label, point, onChange, onPick}: PointInputProps) {
  return (
    <View style={styles.pointInput}>
      <View style={styles.pointInputHeader}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TouchableOpacity style={styles.pickBtn} onPress={onPick}>
          <Text style={styles.pickBtnText}>From project</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, {flex: 1}]}
          value={point.e}
          onChangeText={v => onChange({...point, e: v})}
          keyboardType="numeric"
          placeholder="Easting"
          placeholderTextColor="#4b5563"
        />
        <View style={{width: 8}} />
        <TextInput
          style={[styles.input, {flex: 1}]}
          value={point.n}
          onChangeText={v => onChange({...point, n: v})}
          keyboardType="numeric"
          placeholder="Northing"
          placeholderTextColor="#4b5563"
        />
      </View>
    </View>
  );
}

// ─── Blank point form state ───────────────────────────────────────────────────

const blankPt = () => ({e: '', n: '', name: ''});

// ─── Main component ───────────────────────────────────────────────────────────

export function CogoScreen() {
  const [tool, setTool] = useState<Tool>('inverse');

  // Inverse state
  const [invFrom, setInvFrom] = useState(blankPt());
  const [invTo, setInvTo] = useState(blankPt());
  const [invResult, setInvResult] = useState<{dist: number; bearing: number; dE: number; dN: number} | null>(null);

  // Traverse state
  const [travStart, setTravStart] = useState(blankPt());
  const [travBearing, setTravBearing] = useState('');
  const [travDist, setTravDist] = useState('');
  const [travResult, setTravResult] = useState<{e: number; n: number} | null>(null);

  // Area state
  const [areaPoints, setAreaPoints] = useState<{e: string; n: string; name: string}[]>([blankPt(), blankPt(), blankPt()]);
  const [areaResult, setAreaResult] = useState<{area: number; perimeter: number; areaHa: number} | null>(null);

  // Intersection state
  const [intType, setIntType] = useState<'bearing' | 'distance'>('bearing');
  const [intP1, setIntP1] = useState(blankPt());
  const [intVal1, setIntVal1] = useState('');
  const [intP2, setIntP2] = useState(blankPt());
  const [intVal2, setIntVal2] = useState('');
  const [intResult, setIntResult] = useState<{e: number; n: number} | null>(null);

  // Point picker
  const [pickerTarget, setPickerTarget] = useState<
    | {kind: 'invFrom'} | {kind: 'invTo'} | {kind: 'travStart'}
    | {kind: 'intP1'} | {kind: 'intP2'} | {kind: 'area'; idx: number}
    | null
  >(null);

  function parsePt(pt: {e: string; n: string}): Point2D | null {
    const e = parseFloat(pt.e);
    const n = parseFloat(pt.n);
    if (isNaN(e) || isNaN(n)) return null;
    return {easting: e, northing: n};
  }

  // ── Inverse ────────────────────────────────────────────────────────────────

  function computeInverse() {
    const from = parsePt(invFrom);
    const to = parsePt(invTo);
    if (!from || !to) {Alert.alert('Invalid input', 'Enter valid Easting and Northing for both points.'); return;}
    const r = inverse(from, to);
    setInvResult({dist: r.distance, bearing: r.bearing, dE: r.dE, dN: r.dN});
  }

  // ── Traverse ───────────────────────────────────────────────────────────────

  function computeTraverse() {
    const start = parsePt(travStart);
    const bearing = parseFloat(travBearing);
    const dist = parseFloat(travDist);
    if (!start || isNaN(bearing) || isNaN(dist)) {
      Alert.alert('Invalid input', 'Fill in all traverse fields.');
      return;
    }
    const result = traverseLeg(start, bearing, dist);
    setTravResult({e: result.easting, n: result.northing});
  }

  // ── Area ───────────────────────────────────────────────────────────────────

  function computeArea() {
    const pts: Point2D[] = [];
    for (const p of areaPoints) {
      const parsed = parsePt(p);
      if (!parsed) {Alert.alert('Invalid input', 'All polygon vertices must have valid coordinates.'); return;}
      pts.push(parsed);
    }
    setAreaResult(polygonArea(pts));
  }

  // ── Intersection ───────────────────────────────────────────────────────────

  function computeIntersection() {
    const p1 = parsePt(intP1);
    const p2 = parsePt(intP2);
    const v1 = parseFloat(intVal1);
    const v2 = parseFloat(intVal2);
    if (!p1 || !p2 || isNaN(v1) || isNaN(v2)) {
      Alert.alert('Invalid input', 'Fill in all intersection fields.');
      return;
    }
    if (intType === 'bearing') {
      const r = bearingBearingIntersection(p1, v1, p2, v2);
      if (!r.valid) {Alert.alert('No solution', 'The bearings are parallel or do not intersect.'); return;}
      setIntResult({e: r.easting, n: r.northing});
    } else {
      const {point1} = distanceDistanceIntersection(p1, v1, p2, v2);
      if (!point1.valid) {Alert.alert('No solution', 'The circles do not intersect.'); return;}
      setIntResult({e: point1.easting, n: point1.northing});
    }
  }

  // ── Point picker callback ──────────────────────────────────────────────────

  function onPickPoint(cp: CollectedPoint) {
    const val = {e: cp.easting.toFixed(4), n: cp.northing.toFixed(4), name: cp.name};
    if (!pickerTarget) return;
    switch (pickerTarget.kind) {
      case 'invFrom': setInvFrom(val); break;
      case 'invTo': setInvTo(val); break;
      case 'travStart': setTravStart(val); break;
      case 'intP1': setIntP1(val); break;
      case 'intP2': setIntP2(val); break;
      case 'area': {
        const updated = [...areaPoints];
        updated[pickerTarget.idx] = val;
        setAreaPoints(updated);
        break;
      }
    }
    setPickerTarget(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Tool selector */}
      <View style={styles.toolBar}>
        {TOOLS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.toolTab, tool === t.key && styles.toolTabActive]}
            onPress={() => setTool(t.key)}>
            <Text style={styles.toolIcon}>{t.icon}</Text>
            <Text style={[styles.toolLabel, tool === t.key && styles.toolLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── INVERSE ─────────────────────────────────────────── */}
        {tool === 'inverse' && (
          <>
            <Text style={styles.toolTitle}>Inverse — Distance & Bearing</Text>
            <PointInput label="From" point={invFrom} onChange={setInvFrom}
              onPick={() => setPickerTarget({kind: 'invFrom'})} />
            <PointInput label="To" point={invTo} onChange={setInvTo}
              onPick={() => setPickerTarget({kind: 'invTo'})} />
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={computeInverse}>
              <Text style={styles.btnText}>Compute</Text>
            </TouchableOpacity>
            {invResult && (
              <View style={styles.resultCard}>
                <ResultRow label="Distance" value={`${invResult.dist.toFixed(4)} m`} />
                <ResultRow label="Bearing" value={`${invResult.bearing.toFixed(6)}°`} />
                <ResultRow label="Quadrant" value={bearingToQuadrant(invResult.bearing)} />
                <ResultRow label="ΔEast" value={`${invResult.dE >= 0 ? '+' : ''}${invResult.dE.toFixed(4)} m`} />
                <ResultRow label="ΔNorth" value={`${invResult.dN >= 0 ? '+' : ''}${invResult.dN.toFixed(4)} m`} />
              </View>
            )}
          </>
        )}

        {/* ── TRAVERSE ────────────────────────────────────────── */}
        {tool === 'traverse' && (
          <>
            <Text style={styles.toolTitle}>Single Traverse Leg</Text>
            <PointInput label="Start Point" point={travStart} onChange={setTravStart}
              onPick={() => setPickerTarget({kind: 'travStart'})} />
            <Text style={styles.inputLabel}>Bearing (degrees from north)</Text>
            <TextInput
              style={styles.input}
              value={travBearing}
              onChangeText={setTravBearing}
              keyboardType="numeric"
              placeholder="e.g. 45.5000"
              placeholderTextColor="#4b5563"
            />
            <Text style={styles.inputLabel}>Distance (metres)</Text>
            <TextInput
              style={styles.input}
              value={travDist}
              onChangeText={setTravDist}
              keyboardType="numeric"
              placeholder="e.g. 125.340"
              placeholderTextColor="#4b5563"
            />
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, {marginTop: 8}]} onPress={computeTraverse}>
              <Text style={styles.btnText}>Compute</Text>
            </TouchableOpacity>
            {travResult && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Computed Point</Text>
                <ResultRow label="Easting" value={`${travResult.e.toFixed(4)} m`} />
                <ResultRow label="Northing" value={`${travResult.n.toFixed(4)} m`} />
              </View>
            )}
          </>
        )}

        {/* ── AREA ────────────────────────────────────────────── */}
        {tool === 'area' && (
          <>
            <Text style={styles.toolTitle}>Polygon Area</Text>
            <Text style={styles.subText}>Enter polygon vertices in order (min 3)</Text>

            {areaPoints.map((pt, idx) => (
              <PointInput
                key={idx}
                label={`Vertex ${idx + 1}`}
                point={pt}
                onChange={v => {
                  const updated = [...areaPoints];
                  updated[idx] = v;
                  setAreaPoints(updated);
                }}
                onPick={() => setPickerTarget({kind: 'area', idx})}
              />
            ))}

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, {flex: 1}]}
                onPress={() => setAreaPoints([...areaPoints, blankPt()])}>
                <Text style={styles.btnOutlineText}>+ Vertex</Text>
              </TouchableOpacity>
              {areaPoints.length > 3 && (
                <>
                  <View style={{width: 8}} />
                  <TouchableOpacity
                    style={[styles.btn, styles.btnOutline, {flex: 1}]}
                    onPress={() => setAreaPoints(areaPoints.slice(0, -1))}>
                    <Text style={styles.btnOutlineText}>− Vertex</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity style={[styles.btn, styles.btnPrimary, {marginTop: 8}]} onPress={computeArea}>
              <Text style={styles.btnText}>Compute Area</Text>
            </TouchableOpacity>

            {areaResult && (
              <View style={styles.resultCard}>
                <ResultRow label="Area" value={`${areaResult.area.toFixed(4)} m²`} />
                <ResultRow label="Area (ha)" value={`${areaResult.areaHa.toFixed(6)} ha`} />
                <ResultRow label="Perimeter" value={`${areaResult.perimeter.toFixed(4)} m`} />
              </View>
            )}
          </>
        )}

        {/* ── INTERSECTION ────────────────────────────────────── */}
        {tool === 'intersection' && (
          <>
            <Text style={styles.toolTitle}>Intersection</Text>

            {/* Type toggle */}
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.toggleBtn, intType === 'bearing' && styles.toggleBtnActive]}
                onPress={() => {setIntType('bearing'); setIntResult(null);}}>
                <Text style={[styles.toggleText, intType === 'bearing' && styles.toggleTextActive]}>
                  Bearing–Bearing
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, intType === 'distance' && styles.toggleBtnActive]}
                onPress={() => {setIntType('distance'); setIntResult(null);}}>
                <Text style={[styles.toggleText, intType === 'distance' && styles.toggleTextActive]}>
                  Distance–Distance
                </Text>
              </TouchableOpacity>
            </View>

            <PointInput label="Point 1" point={intP1} onChange={setIntP1}
              onPick={() => setPickerTarget({kind: 'intP1'})} />
            <Text style={styles.inputLabel}>
              {intType === 'bearing' ? 'Bearing from P1 (°)' : 'Distance from P1 (m)'}
            </Text>
            <TextInput
              style={styles.input}
              value={intVal1}
              onChangeText={setIntVal1}
              keyboardType="numeric"
              placeholder={intType === 'bearing' ? '45.0000' : '100.000'}
              placeholderTextColor="#4b5563"
            />

            <PointInput label="Point 2" point={intP2} onChange={setIntP2}
              onPick={() => setPickerTarget({kind: 'intP2'})} />
            <Text style={styles.inputLabel}>
              {intType === 'bearing' ? 'Bearing from P2 (°)' : 'Distance from P2 (m)'}
            </Text>
            <TextInput
              style={styles.input}
              value={intVal2}
              onChangeText={setIntVal2}
              keyboardType="numeric"
              placeholder={intType === 'bearing' ? '135.0000' : '80.000'}
              placeholderTextColor="#4b5563"
            />

            <TouchableOpacity style={[styles.btn, styles.btnPrimary, {marginTop: 8}]} onPress={computeIntersection}>
              <Text style={styles.btnText}>Compute</Text>
            </TouchableOpacity>

            {intResult && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Intersection Point</Text>
                <ResultRow label="Easting" value={`${intResult.e.toFixed(4)} m`} />
                <ResultRow label="Northing" value={`${intResult.n.toFixed(4)} m`} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Point picker modal */}
      <PointPickerModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={onPickPoint}
      />
    </View>
  );
}

// ─── Result row ───────────────────────────────────────────────────────────────

function ResultRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},

  toolBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  toolTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toolTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  toolIcon: {fontSize: 16},
  toolLabel: {fontSize: 10, color: '#6b7280', marginTop: 2},
  toolLabelActive: {color: '#3b82f6', fontWeight: '700'},

  scroll: {flex: 1},
  scrollContent: {padding: 16, paddingBottom: 40},

  toolTitle: {fontSize: 16, fontWeight: '700', color: '#e5e7eb', marginBottom: 4},
  subText: {fontSize: 12, color: '#6b7280', marginBottom: 12},

  pointInput: {marginBottom: 12},
  pointInputHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4},
  pickBtn: {paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1f2937', borderRadius: 6},
  pickBtnText: {fontSize: 11, color: '#60a5fa'},

  inputLabel: {fontSize: 12, color: '#6b7280', marginBottom: 4, marginTop: 8},
  input: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 10,
    color: '#e5e7eb',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  row: {flexDirection: 'row'},

  btn: {borderRadius: 8, padding: 13, alignItems: 'center'},
  btnPrimary: {backgroundColor: '#3b82f6'},
  btnOutline: {borderWidth: 1.5, borderColor: '#374151', backgroundColor: 'transparent'},
  btnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  btnOutlineText: {color: '#9ca3af', fontWeight: '600', fontSize: 14},

  toggleBtn: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    marginBottom: 12,
    marginRight: 4,
  },
  toggleBtnActive: {borderColor: '#3b82f6', backgroundColor: '#1e3a5f'},
  toggleText: {fontSize: 12, color: '#6b7280'},
  toggleTextActive: {color: '#60a5fa', fontWeight: '700'},

  resultCard: {
    marginTop: 16,
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  resultTitle: {fontSize: 13, fontWeight: '700', color: '#e5e7eb', marginBottom: 10},
  resultRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1f2937'},
  resultLabel: {fontSize: 13, color: '#6b7280'},
  resultValue: {fontSize: 13, color: '#e5e7eb', fontFamily: 'monospace', fontWeight: '600'},

  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end'},
  modalBox: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {fontSize: 16, fontWeight: '700', color: '#e5e7eb', marginBottom: 16},
  emptyText: {color: '#4b5563', textAlign: 'center', marginVertical: 20},
  pickerRow: {paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937'},
  pickerName: {fontSize: 14, fontWeight: '600', color: '#e5e7eb'},
  pickerCoords: {fontSize: 11, color: '#6b7280', marginTop: 2},
});
