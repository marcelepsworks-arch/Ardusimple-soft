import {create} from 'zustand';

export interface Project {
  id: string;
  name: string;
  description: string;
  operator: string;
  createdAt: string;
  modifiedAt: string;
  csEpsg: number;       // EPSG code (e.g., 25831 for ETRS89 / UTM 31N)
  csName: string;       // Human-readable name
  csProj4: string;      // proj4 definition string
  codeLibraryId: string | null;
}

export interface CollectedPoint {
  id: string;
  projectId: string;
  name: string;
  code: string;
  description: string;
  easting: number;
  northing: number;
  elevation: number;
  latitude: number;
  longitude: number;
  height: number;
  fixType: string;
  fixQuality: number;
  hdop: number;
  satsUsed: number;
  collectedAt: string;
  note: string;
}

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  points: CollectedPoint[];
  setProjects: (projects: Project[]) => void;
  setActiveProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  setPoints: (points: CollectedPoint[]) => void;
  addPoint: (point: CollectedPoint) => void;
  deletePoint: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProject: null,
  points: [],
  setProjects: projects => set({projects}),
  setActiveProject: activeProject => set({activeProject}),
  addProject: project =>
    set(state => ({projects: [...state.projects, project]})),
  deleteProject: id =>
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      activeProject:
        state.activeProject?.id === id ? null : state.activeProject,
    })),
  setPoints: points => set({points}),
  addPoint: point =>
    set(state => ({points: [...state.points, point]})),
  deletePoint: id =>
    set(state => ({points: state.points.filter(p => p.id !== id)})),
}));
