/**
 * Built-in survey code library — 80+ codes organized by category.
 * Codes are assigned to collected points/lines/polygons for symbology.
 */

export interface SurveyCode {
  id: string;
  name: string;
  description: string;
  type: 'point' | 'line' | 'polygon';
  color: string;
  category: string;
}

export const CODE_CATEGORIES = [
  'Survey',
  'Boundary',
  'Buildings',
  'Roads',
  'Infrastructure',
  'Vegetation',
  'Water',
  'Topography',
  'Utilities',
  'Custom',
] as const;

export const BUILT_IN_CODES: SurveyCode[] = [
  // Survey
  {id: 'CP', name: 'CP', description: 'Control Point', type: 'point', color: '#ef4444', category: 'Survey'},
  {id: 'BM', name: 'BM', description: 'Benchmark', type: 'point', color: '#ef4444', category: 'Survey'},
  {id: 'STN', name: 'STN', description: 'Station', type: 'point', color: '#ef4444', category: 'Survey'},
  {id: 'TP', name: 'TP', description: 'Topo Point', type: 'point', color: '#8b5cf6', category: 'Survey'},
  {id: 'SPOT', name: 'SPOT', description: 'Spot Elevation', type: 'point', color: '#8b5cf6', category: 'Survey'},
  {id: 'REF', name: 'REF', description: 'Reference Point', type: 'point', color: '#ef4444', category: 'Survey'},

  // Boundary
  {id: 'BNDRY', name: 'BNDRY', description: 'Boundary Line', type: 'line', color: '#f59e0b', category: 'Boundary'},
  {id: 'FENCE', name: 'FENCE', description: 'Fence', type: 'line', color: '#92400e', category: 'Boundary'},
  {id: 'HEDGE', name: 'HEDGE', description: 'Hedge', type: 'line', color: '#16a34a', category: 'Boundary'},
  {id: 'WALL', name: 'WALL', description: 'Wall', type: 'line', color: '#78716c', category: 'Boundary'},
  {id: 'GATE', name: 'GATE', description: 'Gate', type: 'point', color: '#92400e', category: 'Boundary'},
  {id: 'POST', name: 'POST', description: 'Fence Post', type: 'point', color: '#92400e', category: 'Boundary'},

  // Buildings
  {id: 'BLDG', name: 'BLDG', description: 'Building Corner', type: 'point', color: '#6366f1', category: 'Buildings'},
  {id: 'BLDGOL', name: 'BLDGOL', description: 'Building Outline', type: 'polygon', color: '#6366f1', category: 'Buildings'},
  {id: 'DOOR', name: 'DOOR', description: 'Door', type: 'point', color: '#6366f1', category: 'Buildings'},
  {id: 'WINDOW', name: 'WINDOW', description: 'Window', type: 'point', color: '#6366f1', category: 'Buildings'},
  {id: 'CORNER', name: 'CORNER', description: 'Building Corner', type: 'point', color: '#6366f1', category: 'Buildings'},
  {id: 'ROOF', name: 'ROOF', description: 'Roof Edge', type: 'line', color: '#6366f1', category: 'Buildings'},

  // Roads
  {id: 'RD', name: 'RD', description: 'Road Centerline', type: 'line', color: '#64748b', category: 'Roads'},
  {id: 'RDEDGE', name: 'RDEDGE', description: 'Road Edge', type: 'line', color: '#94a3b8', category: 'Roads'},
  {id: 'CURB', name: 'CURB', description: 'Curb', type: 'line', color: '#94a3b8', category: 'Roads'},
  {id: 'GUTTER', name: 'GUTTER', description: 'Gutter', type: 'line', color: '#94a3b8', category: 'Roads'},
  {id: 'SWALK', name: 'SWALK', description: 'Sidewalk Edge', type: 'line', color: '#cbd5e1', category: 'Roads'},
  {id: 'DRIVEWAY', name: 'DRIVEWAY', description: 'Driveway', type: 'polygon', color: '#94a3b8', category: 'Roads'},
  {id: 'PARKING', name: 'PARKING', description: 'Parking Area', type: 'polygon', color: '#64748b', category: 'Roads'},

  // Infrastructure
  {id: 'POLE', name: 'POLE', description: 'Utility Pole', type: 'point', color: '#f97316', category: 'Infrastructure'},
  {id: 'LIGHT', name: 'LIGHT', description: 'Street Light', type: 'point', color: '#fbbf24', category: 'Infrastructure'},
  {id: 'SIGN', name: 'SIGN', description: 'Sign', type: 'point', color: '#f97316', category: 'Infrastructure'},
  {id: 'RAIL', name: 'RAIL', description: 'Railway', type: 'line', color: '#57534e', category: 'Infrastructure'},
  {id: 'BRIDGE', name: 'BRIDGE', description: 'Bridge', type: 'line', color: '#78716c', category: 'Infrastructure'},
  {id: 'RETAIN', name: 'RETAIN', description: 'Retaining Wall', type: 'line', color: '#78716c', category: 'Infrastructure'},

  // Vegetation
  {id: 'TREE', name: 'TREE', description: 'Tree', type: 'point', color: '#22c55e', category: 'Vegetation'},
  {id: 'SHRUB', name: 'SHRUB', description: 'Shrub', type: 'point', color: '#4ade80', category: 'Vegetation'},
  {id: 'GRASS', name: 'GRASS', description: 'Grass Area', type: 'polygon', color: '#86efac', category: 'Vegetation'},
  {id: 'GARDEN', name: 'GARDEN', description: 'Garden', type: 'polygon', color: '#22c55e', category: 'Vegetation'},
  {id: 'TREELINE', name: 'TREELINE', description: 'Tree Line', type: 'line', color: '#15803d', category: 'Vegetation'},
  {id: 'CROP', name: 'CROP', description: 'Crop Area', type: 'polygon', color: '#a3e635', category: 'Vegetation'},

  // Water
  {id: 'STREAM', name: 'STREAM', description: 'Stream/Creek', type: 'line', color: '#38bdf8', category: 'Water'},
  {id: 'RIVER', name: 'RIVER', description: 'River Edge', type: 'line', color: '#0ea5e9', category: 'Water'},
  {id: 'POND', name: 'POND', description: 'Pond', type: 'polygon', color: '#0ea5e9', category: 'Water'},
  {id: 'LAKE', name: 'LAKE', description: 'Lake', type: 'polygon', color: '#0284c7', category: 'Water'},
  {id: 'DITCH', name: 'DITCH', description: 'Ditch', type: 'line', color: '#7dd3fc', category: 'Water'},
  {id: 'DRAIN', name: 'DRAIN', description: 'Drain', type: 'point', color: '#7dd3fc', category: 'Water'},
  {id: 'WETLAND', name: 'WETLAND', description: 'Wetland Area', type: 'polygon', color: '#67e8f9', category: 'Water'},

  // Topography
  {id: 'CONT', name: 'CONT', description: 'Contour', type: 'line', color: '#a78bfa', category: 'Topography'},
  {id: 'BREAK', name: 'BREAK', description: 'Breakline', type: 'line', color: '#c084fc', category: 'Topography'},
  {id: 'RIDGE', name: 'RIDGE', description: 'Ridge Line', type: 'line', color: '#c084fc', category: 'Topography'},
  {id: 'VALLEY', name: 'VALLEY', description: 'Valley Line', type: 'line', color: '#a78bfa', category: 'Topography'},
  {id: 'SLOPE', name: 'SLOPE', description: 'Slope Arrow', type: 'point', color: '#a78bfa', category: 'Topography'},
  {id: 'CLIFF', name: 'CLIFF', description: 'Cliff Edge', type: 'line', color: '#7c3aed', category: 'Topography'},

  // Utilities
  {id: 'MH', name: 'MH', description: 'Manhole', type: 'point', color: '#ec4899', category: 'Utilities'},
  {id: 'VALVE', name: 'VALVE', description: 'Valve', type: 'point', color: '#ec4899', category: 'Utilities'},
  {id: 'HYDRANT', name: 'HYDRANT', description: 'Fire Hydrant', type: 'point', color: '#ef4444', category: 'Utilities'},
  {id: 'PIPE', name: 'PIPE', description: 'Pipeline', type: 'line', color: '#ec4899', category: 'Utilities'},
  {id: 'CABLE', name: 'CABLE', description: 'Cable Route', type: 'line', color: '#f472b6', category: 'Utilities'},
  {id: 'ELEC', name: 'ELEC', description: 'Electrical Box', type: 'point', color: '#fbbf24', category: 'Utilities'},
  {id: 'GAS', name: 'GAS', description: 'Gas Marker', type: 'point', color: '#f59e0b', category: 'Utilities'},
  {id: 'TELECOM', name: 'TELECOM', description: 'Telecom Box', type: 'point', color: '#06b6d4', category: 'Utilities'},
];

export function searchCodes(query: string): SurveyCode[] {
  const q = query.toLowerCase();
  return BUILT_IN_CODES.filter(
    c =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
  );
}
