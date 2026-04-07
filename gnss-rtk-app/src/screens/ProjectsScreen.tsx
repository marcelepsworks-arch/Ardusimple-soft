import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useProjectStore, Project} from '../store/useProjectStore';
import {NewProjectModal} from '../components/project/NewProjectModal';

export function ProjectsScreen() {
  const projects = useProjectStore(s => s.projects);
  const activeProject = useProjectStore(s => s.activeProject);
  const setActiveProject = useProjectStore(s => s.setActiveProject);
  const deleteProject = useProjectStore(s => s.deleteProject);
  const [showNew, setShowNew] = useState(false);

  function handleSelect(project: Project) {
    setActiveProject(project);
  }

  function handleDelete(project: Project) {
    Alert.alert(
      'Delete Project',
      `Delete "${project.name}"? This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteProject(project.id),
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.newBtn} onPress={() => setShowNew(true)}>
        <Text style={styles.newBtnText}>+ New Project</Text>
      </TouchableOpacity>

      {activeProject && (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>Active Project</Text>
          <Text style={styles.activeName}>{activeProject.name}</Text>
          <Text style={styles.activeCs}>
            {activeProject.csName} (EPSG:{activeProject.csEpsg})
          </Text>
        </View>
      )}

      <FlatList
        data={projects}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No projects yet. Create one to start surveying.
          </Text>
        }
        renderItem={({item}) => {
          const isActive = activeProject?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.projectItem, isActive && styles.projectItemActive]}
              onPress={() => handleSelect(item)}
              onLongPress={() => handleDelete(item)}>
              <View style={styles.projectInfo}>
                <Text style={styles.projectName}>{item.name}</Text>
                <Text style={styles.projectCs}>
                  {item.csName} (EPSG:{item.csEpsg})
                </Text>
                {item.description ? (
                  <Text style={styles.projectDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              {isActive && <Text style={styles.activeBadge}>Active</Text>}
            </TouchableOpacity>
          );
        }}
      />

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
  },
  newBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  newBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  activeCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  activeLabel: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  activeName: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  activeCs: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  projectItem: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectItemActive: {
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  projectCs: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  projectDesc: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  activeBadge: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
