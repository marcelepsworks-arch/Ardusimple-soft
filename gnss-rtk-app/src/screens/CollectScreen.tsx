import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import {useDeviceStore} from '../store/useDeviceStore';
import {useProjectStore, CollectedPoint} from '../store/useProjectStore';
import {wgs84ToProject} from '../lib/coordinate-systems';
import {fixTypeColor} from '../lib/formats';
import {BUILT_IN_CODES, searchCodes, SurveyCode} from '../lib/code-library';
import {LiveFix} from '../lib/nmea-parser';

type CollectMode = 'single' | 'average';

export function CollectScreen() {
  const fix = useDeviceStore(s => s.liveFix);
  const activeProject = useProjectStore(s => s.activeProject);
  const points = useProjectStore(s => s.points);
  const addPoint = useProjectStore(s => s.addPoint);

  const [mode, setMode] = useState<CollectMode>('single');
  const [name, setName] = useState(() => `PT-${String(points.length + 1).padStart(3, '0')}`);
  const [code, setCode] = useState('TP');
  const [description, setDescription] = useState('');
  const [showCodePicker, setShowCodePicker] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');

  // Averaging state
  const [averaging, setAveraging] = useState(false);
  const [avgSamples, setAvgSamples] = useState<LiveFix[]>([]);
  const [avgDuration, setAvgDuration] = useState(10); // seconds
  const avgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredCodes = codeSearch ? searchCodes(codeSearch) : BUILT_IN_CODES;
  const selectedCode = BUILT_IN_CODES.find(c => c.id === code);

  // Auto-increment name when points change
  useEffect(() => {
    setName(`PT-${String(points.length + 1).padStart(3, '0')}`);
  }, [points.length]);

  const collectSingle = useCallback(() => {
    if (!activeProject) {
      Alert.alert('No Project', 'Create and select a project first.');
      return;
    }
    if (fix.latitude === 0 && fix.longitude === 0) {
      Alert.alert('No Position', 'Wait for a GNSS fix before collecting.');
      return;
    }

    let easting = 0, northing = 0;
    try {
      const proj = wgs84ToProject(fix.longitude, fix.latitude, activeProject.csEpsg);
      easting = proj.easting;
      northing = proj.northing;
    } catch {}

    const point: CollectedPoint = {
      id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProject.id,
      name: name.trim(),
      code,
      description: description.trim(),
      easting,
      northing,
      elevation: fix.altitude,
      latitude: fix.latitude,
      longitude: fix.longitude,
      height: fix.altitude,
      fixType: fix.fixType,
      fixQuality: fix.fixQuality,
      hdop: fix.hdop,
      satsUsed: fix.satsUsed,
      collectedAt: new Date().toISOString(),
      note: '',
    };

    addPoint(point);
    setDescription('');
  }, [activeProject, fix, name, code, description, addPoint]);

  function startAveraging() {
    if (!activeProject) {
      Alert.alert('No Project', 'Create and select a project first.');
      return;
    }
    setAvgSamples([]);
    setAveraging(true);

    avgTimerRef.current = setInterval(() => {
      const currentFix = useDeviceStore.getState().liveFix;
      if (currentFix.latitude !== 0) {
        setAvgSamples(prev => [...prev, {...currentFix}]);
      }
    }, 1000);

    // Auto-stop after duration
    setTimeout(() => stopAveraging(), avgDuration * 1000);
  }

  function stopAveraging() {
    if (avgTimerRef.current) {
      clearInterval(avgTimerRef.current);
      avgTimerRef.current = null;
    }
    setAveraging(false);

    // Compute average
    setAvgSamples(current => {
      if (current.length === 0) return current;

      const avgLat = current.reduce((s, f) => s + f.latitude, 0) / current.length;
      const avgLon = current.reduce((s, f) => s + f.longitude, 0) / current.length;
      const avgAlt = current.reduce((s, f) => s + f.altitude, 0) / current.length;

      let easting = 0, northing = 0;
      if (activeProject) {
        try {
          const proj = wgs84ToProject(avgLon, avgLat, activeProject.csEpsg);
          easting = proj.easting;
          northing = proj.northing;
        } catch {}
      }

      const point: CollectedPoint = {
        id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        projectId: activeProject!.id,
        name: name.trim(),
        code,
        description: description.trim(),
        easting,
        northing,
        elevation: avgAlt,
        latitude: avgLat,
        longitude: avgLon,
        height: avgAlt,
        fixType: `Avg(${current.length})`,
        fixQuality: current[current.length - 1].fixQuality,
        hdop: current.reduce((s, f) => s + f.hdop, 0) / current.length,
        satsUsed: Math.round(current.reduce((s, f) => s + f.satsUsed, 0) / current.length),
        collectedAt: new Date().toISOString(),
        note: `Averaged ${current.length} samples over ${avgDuration}s`,
      };

      addPoint(point);
      setDescription('');
      return [];
    });
  }

  // Compute projected coords for display
  let projected: {easting: number; northing: number} | null = null;
  if (activeProject && fix.latitude !== 0) {
    try {
      projected = wgs84ToProject(fix.longitude, fix.latitude, activeProject.csEpsg);
    } catch {}
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current position */}
      <View style={styles.posCard}>
        <View style={styles.fixRow}>
          <Text style={[styles.fixBadge, {
            backgroundColor: fixTypeColor(fix.fixQuality) + '33',
            color: fixTypeColor(fix.fixQuality),
          }]}>
            {fix.fixType}
          </Text>
          <Text style={styles.stat}>Sats: {fix.satsUsed}</Text>
          <Text style={styles.stat}>HDOP: {fix.hdop.toFixed(1)}</Text>
        </View>
        {projected && (
          <View style={styles.coordRow}>
            <Text style={styles.coord}>E: {projected.easting.toFixed(3)}</Text>
            <Text style={styles.coord}>N: {projected.northing.toFixed(3)}</Text>
            <Text style={styles.coord}>Z: {fix.altitude.toFixed(3)}</Text>
          </View>
        )}
      </View>

      {/* Point name */}
      <Text style={styles.label}>Point Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="PT-001"
        placeholderTextColor="#6b7280"
      />

      {/* Code picker */}
      <Text style={styles.label}>Code</Text>
      <TouchableOpacity
        style={styles.codePicker}
        onPress={() => setShowCodePicker(!showCodePicker)}>
        <View style={[styles.codeColor, {backgroundColor: selectedCode?.color || '#8b5cf6'}]} />
        <Text style={styles.codeText}>{code}</Text>
        <Text style={styles.codeDesc}>{selectedCode?.description || ''}</Text>
      </TouchableOpacity>

      {showCodePicker && (
        <View style={styles.codeDropdown}>
          <TextInput
            style={styles.codeSearchInput}
            value={codeSearch}
            onChangeText={setCodeSearch}
            placeholder="Search codes..."
            placeholderTextColor="#6b7280"
            autoFocus
          />
          <FlatList
            data={filteredCodes}
            keyExtractor={item => item.id}
            style={styles.codeList}
            keyboardShouldPersistTaps="handled"
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.codeItem}
                onPress={() => {
                  setCode(item.id);
                  setShowCodePicker(false);
                  setCodeSearch('');
                }}>
                <View style={[styles.codeColor, {backgroundColor: item.color}]} />
                <View style={{flex: 1}}>
                  <Text style={styles.codeItemName}>{item.name} — {item.description}</Text>
                  <Text style={styles.codeItemCat}>{item.category} · {item.type}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional note"
        placeholderTextColor="#6b7280"
      />

      {/* Collection mode */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'single' && styles.modeBtnActive]}
          onPress={() => setMode('single')}>
          <Text style={[styles.modeBtnText, mode === 'single' && styles.modeBtnTextActive]}>
            Single Shot
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'average' && styles.modeBtnActive]}
          onPress={() => setMode('average')}>
          <Text style={[styles.modeBtnText, mode === 'average' && styles.modeBtnTextActive]}>
            Average
          </Text>
        </TouchableOpacity>
      </View>

      {/* Averaging options */}
      {mode === 'average' && (
        <View style={styles.avgOptions}>
          <Text style={styles.label}>Duration (seconds)</Text>
          <View style={styles.durationRow}>
            {[5, 10, 20, 30, 60].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.durationBtn, avgDuration === d && styles.durationBtnActive]}
                onPress={() => setAvgDuration(d)}>
                <Text style={[styles.durationText, avgDuration === d && styles.durationTextActive]}>
                  {d}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Averaging progress */}
      {averaging && (
        <View style={styles.avgProgress}>
          <Text style={styles.avgProgressText}>
            Averaging: {avgSamples.length} samples
          </Text>
          <View style={styles.avgBar}>
            <View style={[styles.avgBarFill, {
              width: `${Math.min(100, (avgSamples.length / avgDuration) * 100)}%`,
            }]} />
          </View>
        </View>
      )}

      {/* Collect button */}
      <TouchableOpacity
        style={[styles.collectBtn, averaging && styles.collectBtnStop]}
        onPress={
          mode === 'single'
            ? collectSingle
            : averaging
              ? stopAveraging
              : startAveraging
        }>
        <Text style={styles.collectBtnText}>
          {mode === 'single'
            ? 'COLLECT POINT'
            : averaging
              ? 'STOP & SAVE'
              : 'START AVERAGING'}
        </Text>
      </TouchableOpacity>

      {/* Recent points */}
      {points.length > 0 && (
        <>
          <Text style={styles.recentTitle}>
            Collected Points ({points.length})
          </Text>
          {points.slice(-5).reverse().map(pt => (
            <View key={pt.id} style={styles.recentItem}>
              <Text style={styles.recentName}>{pt.name}</Text>
              <Text style={styles.recentCode}>{pt.code}</Text>
              <Text style={styles.recentCoord}>
                E:{pt.easting.toFixed(3)} N:{pt.northing.toFixed(3)} Z:{pt.elevation.toFixed(3)}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#111827'},
  content: {padding: 16, paddingBottom: 40, gap: 6},
  posCard: {backgroundColor: '#1f2937', borderRadius: 10, padding: 12, gap: 6, marginBottom: 8},
  fixRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  fixBadge: {fontSize: 12, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden'},
  stat: {color: '#9ca3af', fontSize: 12, fontFamily: 'monospace'},
  coordRow: {flexDirection: 'row', gap: 12},
  coord: {color: '#d1d5db', fontSize: 12, fontFamily: 'monospace'},
  label: {color: '#9ca3af', fontSize: 12, marginTop: 6},
  input: {backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#e5e7eb', fontSize: 14},
  codePicker: {backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8},
  codeColor: {width: 14, height: 14, borderRadius: 7},
  codeText: {color: '#e5e7eb', fontSize: 14, fontWeight: '600'},
  codeDesc: {color: '#6b7280', fontSize: 12, flex: 1},
  codeDropdown: {backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 8, maxHeight: 200},
  codeSearchInput: {borderBottomWidth: 1, borderBottomColor: '#374151', paddingHorizontal: 12, paddingVertical: 8, color: '#e5e7eb', fontSize: 13},
  codeList: {maxHeight: 160},
  codeItem: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111827'},
  codeItemName: {color: '#d1d5db', fontSize: 13},
  codeItemCat: {color: '#6b7280', fontSize: 11},
  modeRow: {flexDirection: 'row', gap: 8, marginTop: 8},
  modeBtn: {flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#374151'},
  modeBtnActive: {backgroundColor: '#1e3a5f', borderColor: '#3b82f6'},
  modeBtnText: {color: '#9ca3af', fontWeight: '600', fontSize: 13},
  modeBtnTextActive: {color: '#93c5fd'},
  avgOptions: {marginTop: 4},
  durationRow: {flexDirection: 'row', gap: 6},
  durationBtn: {paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#374151'},
  durationBtnActive: {backgroundColor: '#1e3a5f', borderColor: '#3b82f6'},
  durationText: {color: '#9ca3af', fontSize: 13},
  durationTextActive: {color: '#93c5fd'},
  avgProgress: {backgroundColor: '#1f2937', borderRadius: 8, padding: 12, marginTop: 4},
  avgProgressText: {color: '#d1d5db', fontSize: 13, marginBottom: 6},
  avgBar: {height: 6, backgroundColor: '#374151', borderRadius: 3, overflow: 'hidden'},
  avgBarFill: {height: '100%', backgroundColor: '#3b82f6', borderRadius: 3},
  collectBtn: {backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 12},
  collectBtnStop: {backgroundColor: '#dc2626'},
  collectBtnText: {color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 1},
  recentTitle: {color: '#9ca3af', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 20, marginBottom: 6},
  recentItem: {backgroundColor: '#1f2937', borderRadius: 8, padding: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8},
  recentName: {color: '#e5e7eb', fontWeight: '600', fontSize: 13, width: 60},
  recentCode: {color: '#9ca3af', fontSize: 12, width: 40},
  recentCoord: {color: '#6b7280', fontSize: 11, fontFamily: 'monospace', flex: 1},
});
