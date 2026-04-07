import { useDeviceStore } from "../../store/useDeviceStore";
import { formatCoord, fixTypeLabel, fixTypeColor } from "../../lib/formats";

export function StatusBar() {
  const fix = useDeviceStore((s) => s.liveFix);
  const connState = useDeviceStore((s) => s.connectionState);

  return (
    <div className="h-10 bg-gray-950 border-t border-gray-800 flex items-center px-4 gap-6 text-xs font-mono">
      {/* Connection indicator */}
      <span className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor:
              connState === "connected"
                ? "#22c55e"
                : connState === "error"
                ? "#ef4444"
                : "#6b7280",
          }}
        />
        {connState === "connected" ? "Connected" : connState === "error" ? "Error" : "Disconnected"}
      </span>

      {fix ? (
        <>
          <span
            className="px-2 py-0.5 rounded font-bold"
            style={{
              backgroundColor: fixTypeColor(fix.fix_quality) + "22",
              color: fixTypeColor(fix.fix_quality),
            }}
          >
            {fixTypeLabel(fix.fix_quality)}
          </span>
          <span>Lat: {formatCoord(fix.latitude, true)}</span>
          <span>Lon: {formatCoord(fix.longitude, false)}</span>
          <span>Alt: {fix.altitude.toFixed(3)}m</span>
          <span>Sats: {fix.sats_used}</span>
          <span>HDOP: {fix.hdop.toFixed(1)}</span>
          {fix.age_of_corrections > 0 && (
            <span>Age: {fix.age_of_corrections.toFixed(1)}s</span>
          )}
        </>
      ) : (
        <span className="text-gray-500">No position data</span>
      )}
    </div>
  );
}
