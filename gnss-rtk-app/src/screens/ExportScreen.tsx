import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import {useProjectStore, CollectedPoint} from '../store/useProjectStore';
import {
  pointsToCSV,
  pointsToGeoJSON,
  pointsToKML,
  pointsToDXF,
  csvToPoints,
  geoJSONToPoints,
  exportToFile,
  shareFile,
  readFileContent,
} from '../services/export-service';

type ExportFormat = 'csv' | 'geojson' | 'kml' | 'dxf';

const FORMATS: {key: ExportFormat; label: string; icon: string; mime: string}[] = [
  {key: 'csv', label: 'CSV', icon: '📋', mime: 'text/csv'},
  {key: 'geojson', label: 'GeoJSON', icon: '🗺️', mime: 'application/geo+json'},
  {key: 'kml', label: 'KML', icon: '📍', mime: 'application/vnd.google-earth.kml+xml'},
  {key: 'dxf', label: 'DXF (CAD)', icon: '📐', mime: 'application/dxf'},
];

export function ExportScreen() {
  const {activeProject, points} = useProjectStore();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const projectPoints = points.filter(
    p => p.projectId === activeProject?.id,
  );

  async function handleExport() {
    if (!activeProject) {
      Alert.alert('No Project', 'Please select an active project first.');
      return;
    }
    if (projectPoints.length === 0) {
      Alert.alert('No Points', 'There are no points to export in this project.');
      return;
    }

    setExporting(true);
    try {
      let content = '';
      let filename = `${activeProject.name.replace(/\s+/g, '_')}`;
      let mime = '';

      switch (selectedFormat) {
        case 'csv':
          content = pointsToCSV(projectPoints, activeProject);
          filename += '.csv';
          mime = 'text/csv';
          break;
        case 'geojson':
          content = pointsToGeoJSON(projectPoints);
          filename += '.geojson';
          mime = 'application/geo+json';
          break;
        case 'kml':
          content = pointsToKML(projectPoints, activeProject.name);
          filename += '.kml';
          mime = 'application/vnd.google-earth.kml+xml';
          break;
        case 'dxf':
          content = pointsToDXF(projectPoints);
          filename += '.dxf';
          mime = 'application/dxf';
          break;
      }

      const filePath = await exportToFile(content, filename, mime);
      await shareFile(filePath, mime);
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!activeProject) {
      Alert.alert('No Project', 'Please select an active project first.');
      return;
    }

    setImporting(true);
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });

      const uri = result.fileCopyUri ?? result.uri;
      const content = await readFileContent(uri);
      const name = result.name ?? '';
      const ext = name.split('.').pop()?.toLowerCase();

      let imported: CollectedPoint[] = [];
      if (ext === 'csv') {
        imported = csvToPoints(content, activeProject.id);
      } else if (ext === 'geojson' || ext === 'json') {
        imported = geoJSONToPoints(content, activeProject.id);
      } else {
        Alert.alert('Unsupported Format', 'Only CSV and GeoJSON files can be imported.');
        return;
      }

      if (imported.length === 0) {
        Alert.alert('Import Failed', 'No valid points found in file.');
        return;
      }

      const {addPoint} = useProjectStore.getState();
      imported.forEach(p => addPoint(p));
      Alert.alert('Import Successful', `Imported ${imported.length} point(s).`);
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Import Failed', err.message || 'Unknown error');
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Active project info */}
      <View style={styles.projectCard}>
        <Text style={styles.projectLabel}>Active Project</Text>
        <Text style={styles.projectName}>
          {activeProject ? activeProject.name : 'None selected'}
        </Text>
        {activeProject && (
          <Text style={styles.projectMeta}>
            {projectPoints.length} point{projectPoints.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Export section */}
      <Text style={styles.sectionTitle}>Export</Text>
      <Text style={styles.sectionSub}>Select format and share or save to device</Text>

      <View style={styles.formatGrid}>
        {FORMATS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.formatCard,
              selectedFormat === f.key && styles.formatCardActive,
            ]}
            onPress={() => setSelectedFormat(f.key)}>
            <Text style={styles.formatIcon}>{f.icon}</Text>
            <Text
              style={[
                styles.formatLabel,
                selectedFormat === f.key && styles.formatLabelActive,
              ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary, exporting && styles.btnDisabled]}
        onPress={handleExport}
        disabled={exporting}>
        {exporting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Export {selectedFormat.toUpperCase()}</Text>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Import section */}
      <Text style={styles.sectionTitle}>Import</Text>
      <Text style={styles.sectionSub}>
        Import points from CSV or GeoJSON into the active project
      </Text>

      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary, importing && styles.btnDisabled]}
        onPress={handleImport}
        disabled={importing}>
        {importing ? (
          <ActivityIndicator color="#3b82f6" />
        ) : (
          <Text style={[styles.btnText, {color: '#3b82f6'}]}>Choose File to Import</Text>
        )}
      </TouchableOpacity>

      <View style={styles.importNote}>
        <Text style={styles.importNoteText}>
          Supported formats: CSV, GeoJSON{'\n'}
          Points will be added to the active project
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},
  content: {padding: 16, paddingBottom: 40},

  projectCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  projectLabel: {fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8},
  projectName: {fontSize: 17, color: '#e5e7eb', fontWeight: '600', marginTop: 4},
  projectMeta: {fontSize: 13, color: '#9ca3af', marginTop: 2},

  sectionTitle: {fontSize: 15, fontWeight: '700', color: '#e5e7eb', marginBottom: 4},
  sectionSub: {fontSize: 12, color: '#6b7280', marginBottom: 16},

  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  formatCard: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
    alignItems: 'center',
  },
  formatCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },
  formatIcon: {fontSize: 24, marginBottom: 6},
  formatLabel: {fontSize: 13, color: '#9ca3af', fontWeight: '500'},
  formatLabelActive: {color: '#60a5fa'},

  btn: {
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnPrimary: {backgroundColor: '#3b82f6'},
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  btnDisabled: {opacity: 0.5},
  btnText: {fontSize: 15, fontWeight: '700', color: '#fff'},

  divider: {
    height: 1,
    backgroundColor: '#1f2937',
    marginVertical: 24,
  },

  importNote: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  importNoteText: {fontSize: 12, color: '#6b7280', lineHeight: 18},
});
