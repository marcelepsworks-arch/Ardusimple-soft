/**
 * DTM Screen — Digital Terrain Model tools.
 *
 * Tabs:
 *  1. Surface   — build TIN from project points, view stats
 *  2. Query     — query elevation at any E/N coordinate
 *  3. Contours  — generate + display contour levels
 */

import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {useProjectStore} from '../store/useProjectStore';
import {useDeviceStore} from '../store/useDeviceStore';
import {
  buildSurface,
  queryElevation,
  generateContours,
  autoContourLevels,
  DTMSurface,
  ContourLine,
} from '../lib/dtm';

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'surface' | 'query' | 'contours';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({title}: {title: string}) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DtmScreen() {
  const {points, activeProject} = useProjectStore();
  const {liveFix} = useDeviceStore();

  const [tab, setTab] = useState<Tab>('surface');
  const [surface, setSurface] = useState<DTMSurface | null>(null);
  const [building, setBuilding] = useState(false);

  // Query state
  const [queryE, setQueryE] = useState('');
  const [queryN, setQueryN] = useState('');
  const [queryResult, setQueryResult] = useState<number | null | 'outside'>('outside');
  const [queryDone, setQueryDone] = useState(false);

  // Contour state
  const [contourInterval, setContourInterval] = useState('1.0');
  const [contours, setContours] = useState<ContourLine[]>([]);
  const [contoursReady, setContoursReady] = useState(false);

  const projectPoints = points.filter(p => p.projectId === activeProject?.id);

  // ── Build surface ──────────────────────────────────────────────────────────

  const buildDTM = useCallback(() => {
    if (projectPoints.length < 3) {
      Alert.alert('Not enough points', 'You need at least 3 points to build a surface.');
      return;
    }

    setBuilding(true);
    // Run off the main thread cycle to allow render
    setTimeout(() => {
      try {
        const pts = projectPoints.map(p => ({
          easting: p.easting,
          northing: p.northing,
          elevation: p.elevation,
          name: p.name,
        }));
        const s = buildSurface(pts);
        setSurface(s);
        setContoursReady(false);
        setQueryDone(false);
      } catch (err: any) {
        Alert.alert('Build failed', err.message || 'Unknown error');
      } finally {
        setBuilding(false);
      }
    }, 50);
  }, [projectPoints]);

  // ── Query elevation ────────────────────────────────────────────────────────

  function handleQuery() {
    if (!surface) {Alert.alert('No surface', 'Build a surface first.'); return;}
    const e = parseFloat(queryE);
    const n = parseFloat(queryN);
    if (isNaN(e) || isNaN(n)) {Alert.alert('Invalid input', 'Enter valid Easting and Northing.'); return;}
    const elev = queryElevation(e, n, surface.triangles);
    setQueryResult(elev === null ? 'outside' : elev);
    setQueryDone(true);
  }

  function useCurrentPosition() {
    if (!liveFix.latitude || !liveFix.longitude) {
      Alert.alert('No fix', 'Waiting for GNSS position.');
      return;
    }
    // The surface is in projected coords — use the fix's projected coords
    // For now, just show the altitude from the live fix
    Alert.alert(
      'Live Elevation',
      `Ellipsoidal height from GNSS: ${liveFix.altitude.toFixed(3)} m\n\nFor projected elevation query, enter Easting/Northing manually.`,
    );
  }

  // ── Generate contours ──────────────────────────────────────────────────────

  function handleGenerateContours() {
    if (!surface) {Alert.alert('No surface', 'Build a surface first.'); return;}
    const interval = parseFloat(contourInterval);
    if (isNaN(interval) || interval <= 0) {
      Alert.alert('Invalid interval', 'Enter a positive contour interval.');
      return;
    }

    const levels = autoContourLevels(surface.stats, interval);
    if (levels.length === 0) {
      Alert.alert('No contours', 'No contour levels found within surface elevation range.');
      return;
    }
    if (levels.length > 200) {
      Alert.alert('Too many levels', `Interval produces ${levels.length} contours. Use a larger interval.`);
      return;
    }

    const lines = generateContours(surface.triangles, levels);
    setContours(lines);
    setContoursReady(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['surface', 'query', 'contours'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'surface' ? 'Surface' : t === 'query' ? 'Query' : 'Contours'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── SURFACE tab ─────────────────────────────────────── */}
        {tab === 'surface' && (
          <>
            <SectionTitle title="Build TIN Surface" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Active project: <Text style={styles.infoHighlight}>{activeProject?.name ?? 'None'}</Text>
              </Text>
              <Text style={styles.infoText}>
                Eligible points: <Text style={styles.infoHighlight}>{projectPoints.length}</Text>
                {projectPoints.length < 3 && (
                  <Text style={styles.infoWarn}> (need ≥ 3)</Text>
                )}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, building && styles.btnDisabled]}
              onPress={buildDTM}
              disabled={building || projectPoints.length < 3}>
              {building
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>
                    {surface ? 'Rebuild Surface' : 'Build Surface'}
                  </Text>}
            </TouchableOpacity>

            {surface && (
              <>
                <SectionTitle title="Surface Statistics" />
                <View style={styles.statsCard}>
                  <StatRow label="Points" value={`${surface.stats.pointCount}`} />
                  <StatRow label="Triangles" value={`${surface.stats.triangleCount}`} />
                  <StatRow label="Min Elevation" value={`${surface.stats.minElev.toFixed(3)} m`} />
                  <StatRow label="Max Elevation" value={`${surface.stats.maxElev.toFixed(3)} m`} />
                  <StatRow label="Mean Elevation" value={`${surface.stats.meanElev.toFixed(3)} m`} />
                  <StatRow label="Elevation Range" value={`${surface.stats.rangeElev.toFixed(3)} m`} />
                  <StatRow label="Surface Area" value={`${surface.stats.surfaceArea.toFixed(2)} m²`} />
                  <StatRow
                    label="Volume Above Datum"
                    value={`${surface.stats.volumeAboveDatum.toFixed(2)} m³`}
                  />
                </View>

                <SectionTitle title="Bounding Box" />
                <View style={styles.statsCard}>
                  <StatRow label="Min Easting" value={`${surface.boundingBox.minE.toFixed(3)} m`} />
                  <StatRow label="Max Easting" value={`${surface.boundingBox.maxE.toFixed(3)} m`} />
                  <StatRow label="Min Northing" value={`${surface.boundingBox.minN.toFixed(3)} m`} />
                  <StatRow label="Max Northing" value={`${surface.boundingBox.maxN.toFixed(3)} m`} />
                </View>
              </>
            )}
          </>
        )}

        {/* ── QUERY tab ───────────────────────────────────────── */}
        {tab === 'query' && (
          <>
            <SectionTitle title="Elevation Query" />
            {!surface ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>Build a surface first (Surface tab).</Text>
              </View>
            ) : (
              <>
                <Text style={styles.subText}>
                  Enter a projected coordinate to interpolate its elevation from the TIN surface.
                </Text>

                <Text style={styles.inputLabel}>Easting (m)</Text>
                <TextInput
                  style={styles.input}
                  value={queryE}
                  onChangeText={v => {setQueryE(v); setQueryDone(false);}}
                  keyboardType="numeric"
                  placeholder="e.g. 431500.000"
                  placeholderTextColor="#4b5563"
                />

                <Text style={styles.inputLabel}>Northing (m)</Text>
                <TextInput
                  style={styles.input}
                  value={queryN}
                  onChangeText={v => {setQueryN(v); setQueryDone(false);}}
                  keyboardType="numeric"
                  placeholder="e.g. 4580200.000"
                  placeholderTextColor="#4b5563"
                />

                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, {flex: 1}]}
                    onPress={handleQuery}>
                    <Text style={styles.btnText}>Query</Text>
                  </TouchableOpacity>
                  <View style={{width: 8}} />
                  <TouchableOpacity
                    style={[styles.btn, styles.btnOutline, {flex: 1}]}
                    onPress={useCurrentPosition}>
                    <Text style={styles.btnOutlineText}>Use GPS</Text>
                  </TouchableOpacity>
                </View>

                {queryDone && (
                  <View style={[styles.statsCard, {marginTop: 16}]}>
                    {queryResult === 'outside' ? (
                      <Text style={styles.outsideText}>
                        Point is outside the triangulated surface extent.
                      </Text>
                    ) : (
                      <>
                        <StatRow label="Easting" value={`${parseFloat(queryE).toFixed(4)} m`} />
                        <StatRow label="Northing" value={`${parseFloat(queryN).toFixed(4)} m`} />
                        <View style={styles.resultHighlight}>
                          <Text style={styles.resultHighlightLabel}>Interpolated Elevation</Text>
                          <Text style={styles.resultHighlightValue}>
                            {(queryResult as number).toFixed(4)} m
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ── CONTOURS tab ────────────────────────────────────── */}
        {tab === 'contours' && (
          <>
            <SectionTitle title="Contour Generation" />
            {!surface ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>Build a surface first (Surface tab).</Text>
              </View>
            ) : (
              <>
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>
                    Elevation range:{' '}
                    <Text style={styles.infoHighlight}>
                      {surface.stats.minElev.toFixed(2)} – {surface.stats.maxElev.toFixed(2)} m
                    </Text>
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Contour Interval (m)</Text>
                <TextInput
                  style={styles.input}
                  value={contourInterval}
                  onChangeText={v => {setContourInterval(v); setContoursReady(false);}}
                  keyboardType="numeric"
                  placeholder="1.0"
                  placeholderTextColor="#4b5563"
                />

                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={handleGenerateContours}>
                  <Text style={styles.btnText}>Generate Contours</Text>
                </TouchableOpacity>

                {contoursReady && contours.length > 0 && (
                  <>
                    <View style={styles.statsCard}>
                      <StatRow label="Contour levels" value={`${contours.length}`} />
                      <StatRow
                        label="Total segments"
                        value={`${contours.reduce((s, c) => s + c.segments.length, 0)}`}
                      />
                      <StatRow label="Interval" value={`${contourInterval} m`} />
                    </View>

                    <SectionTitle title="Contour Levels" />
                    <FlatList
                      data={contours}
                      keyExtractor={item => `${item.elevation}`}
                      scrollEnabled={false}
                      renderItem={({item}) => (
                        <View style={styles.contourRow}>
                          <View
                            style={[
                              styles.contourDot,
                              {
                                backgroundColor: elevationColor(
                                  item.elevation,
                                  surface.stats.minElev,
                                  surface.stats.maxElev,
                                ),
                              },
                            ]}
                          />
                          <Text style={styles.contourElev}>
                            {item.elevation.toFixed(2)} m
                          </Text>
                          <Text style={styles.contourSegs}>
                            {item.segments.length} seg
                          </Text>
                        </View>
                      )}
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Map elevation to a heatmap color (blue → green → yellow → red) */
function elevationColor(elev: number, min: number, max: number): string {
  if (max === min) return '#3b82f6';
  const t = (elev - min) / (max - min); // 0→1

  // Blue → Cyan → Green → Yellow → Red
  if (t < 0.25) {
    const s = t / 0.25;
    const g = Math.round(s * 255);
    return `rgb(0,${g},255)`;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    const b = Math.round((1 - s) * 255);
    return `rgb(0,255,${b})`;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    const r = Math.round(s * 255);
    return `rgb(${r},255,0)`;
  } else {
    const s = (t - 0.75) / 0.25;
    const g = Math.round((1 - s) * 255);
    return `rgb(255,${g},0)`;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  tab: {flex: 1, paddingVertical: 13, alignItems: 'center'},
  tabActive: {borderBottomWidth: 2, borderBottomColor: '#3b82f6'},
  tabText: {fontSize: 13, color: '#6b7280', fontWeight: '500'},
  tabTextActive: {color: '#3b82f6', fontWeight: '700'},

  scroll: {flex: 1},
  scrollContent: {padding: 16, paddingBottom: 40},

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  subText: {fontSize: 12, color: '#6b7280', marginBottom: 12},

  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  infoText: {fontSize: 13, color: '#9ca3af', marginBottom: 2},
  infoHighlight: {color: '#e5e7eb', fontWeight: '600'},
  infoWarn: {color: '#f59e0b', fontWeight: '600'},

  warningCard: {
    backgroundColor: '#1c1308',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#92400e',
    marginTop: 8,
  },
  warningText: {color: '#f59e0b', fontSize: 13},

  statsCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  statLabel: {fontSize: 13, color: '#6b7280'},
  statValue: {fontSize: 13, color: '#e5e7eb', fontFamily: 'monospace', fontWeight: '600'},

  btn: {borderRadius: 8, padding: 13, alignItems: 'center', marginBottom: 8},
  btnPrimary: {backgroundColor: '#3b82f6'},
  btnOutline: {borderWidth: 1.5, borderColor: '#374151', backgroundColor: 'transparent'},
  btnDisabled: {opacity: 0.5},
  btnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  btnOutlineText: {color: '#9ca3af', fontWeight: '600', fontSize: 14},

  inputLabel: {fontSize: 12, color: '#6b7280', marginBottom: 4, marginTop: 8},
  input: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 10,
    color: '#e5e7eb',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 8,
  },
  row: {flexDirection: 'row'},

  outsideText: {color: '#f87171', fontSize: 13, padding: 12},
  resultHighlight: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    margin: 8,
    padding: 14,
    alignItems: 'center',
  },
  resultHighlightLabel: {fontSize: 11, color: '#60a5fa', letterSpacing: 0.8, textTransform: 'uppercase'},
  resultHighlightValue: {fontSize: 28, fontWeight: '800', color: '#e5e7eb', marginTop: 4},

  contourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    backgroundColor: '#111827',
  },
  contourDot: {width: 12, height: 12, borderRadius: 6, marginRight: 10},
  contourElev: {flex: 1, fontSize: 13, color: '#e5e7eb', fontFamily: 'monospace'},
  contourSegs: {fontSize: 11, color: '#6b7280'},
});
