import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import {useProjectStore, Project} from '../../store/useProjectStore';
import {searchCS, COORDINATE_SYSTEMS, CoordinateSystem} from '../../lib/coordinate-systems';

interface Props {
  onClose: () => void;
}

export function NewProjectModal({onClose}: Props) {
  const addProject = useProjectStore(s => s.addProject);
  const setActiveProject = useProjectStore(s => s.setActiveProject);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [operator, setOperator] = useState('');
  const [csSearch, setCsSearch] = useState('');
  const [selectedCS, setSelectedCS] = useState<CoordinateSystem>(
    COORDINATE_SYSTEMS[0],
  );
  const [showCsPicker, setShowCsPicker] = useState(false);

  const filteredCS = csSearch ? searchCS(csSearch) : COORDINATE_SYSTEMS;

  function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a project name.');
      return;
    }

    const now = new Date().toISOString();
    const project: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      description: description.trim(),
      operator: operator.trim(),
      createdAt: now,
      modifiedAt: now,
      csEpsg: selectedCS.epsg,
      csName: selectedCS.name,
      csProj4: selectedCS.proj4def,
      codeLibraryId: null,
    };

    addProject(project);
    setActiveProject(project);
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>New Project</Text>

          <Text style={styles.label}>Project Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Site Survey 2026"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Operator</Text>
          <TextInput
            style={styles.input}
            value={operator}
            onChangeText={setOperator}
            placeholder="Your name"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Coordinate System</Text>
          <TouchableOpacity
            style={styles.csPicker}
            onPress={() => setShowCsPicker(!showCsPicker)}>
            <Text style={styles.csPickerText}>
              {selectedCS.name} (EPSG:{selectedCS.epsg})
            </Text>
            <Text style={styles.csPickerCountry}>{selectedCS.country}</Text>
          </TouchableOpacity>

          {showCsPicker && (
            <View style={styles.csDropdown}>
              <TextInput
                style={styles.csSearchInput}
                value={csSearch}
                onChangeText={setCsSearch}
                placeholder="Search by name, country, or EPSG..."
                placeholderTextColor="#6b7280"
                autoFocus
              />
              <FlatList
                data={filteredCS}
                keyExtractor={item => item.epsg.toString()}
                style={styles.csList}
                keyboardShouldPersistTaps="handled"
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={[
                      styles.csItem,
                      item.epsg === selectedCS.epsg && styles.csItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedCS(item);
                      setShowCsPicker(false);
                      setCsSearch('');
                    }}>
                    <Text style={styles.csItemName}>{item.name}</Text>
                    <Text style={styles.csItemMeta}>
                      EPSG:{item.epsg} · {item.country}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createText}>Create Project</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1f2937',
    borderRadius: 14,
    padding: 20,
    maxHeight: '90%',
  },
  title: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
    fontSize: 14,
  },
  csPicker: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
  },
  csPickerText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  csPickerCountry: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 2,
  },
  csDropdown: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  csSearchInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#e5e7eb',
    fontSize: 13,
  },
  csList: {
    maxHeight: 160,
  },
  csItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  csItemSelected: {
    backgroundColor: '#1e3a5f',
  },
  csItemName: {
    color: '#d1d5db',
    fontSize: 13,
  },
  csItemMeta: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cancelText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  createBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  createText: {
    color: '#fff',
    fontWeight: '700',
  },
});
