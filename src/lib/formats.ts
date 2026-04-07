export function formatCoord(deg: number, isLat: boolean): string {
  const dir = isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W";
  return `${Math.abs(deg).toFixed(7)}° ${dir}`;
}

export function fixTypeLabel(quality: number): string {
  switch (quality) {
    case 0: return "No Fix";
    case 1: return "Single";
    case 2: return "DGPS";
    case 4: return "RTK Fix";
    case 5: return "RTK Float";
    default: return `Q${quality}`;
  }
}

export function fixTypeColor(quality: number): string {
  switch (quality) {
    case 4: return "#22c55e"; // green - RTK Fix
    case 5: return "#f59e0b"; // amber - Float
    case 1: case 2: return "#3b82f6"; // blue - Single/DGPS
    default: return "#ef4444"; // red - No fix
  }
}
