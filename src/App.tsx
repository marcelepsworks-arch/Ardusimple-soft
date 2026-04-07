import { useEffect, useState } from "react";
import { MapView } from "./components/map/MapView";
import { StatusBar } from "./components/device/StatusBar";
import { DevicePanel } from "./components/device/DevicePanel";
import { NtripPanel } from "./components/ntrip/NtripPanel";
import { startFixListener, startConnectionListener } from "./lib/nmea-listener";
import {
  Map,
  Crosshair,
  Satellite,
  Radio,
  Settings,
} from "lucide-react";

type Panel = "map" | "device" | "ntrip" | "settings" | null;

export default function App() {
  const [activePanel, setActivePanel] = useState<Panel>("device");

  useEffect(() => {
    const unlisteners = Promise.all([
      startFixListener(),
      startConnectionListener(),
    ]);
    return () => {
      unlisteners.then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  const navItems: { id: Panel; icon: React.ReactNode; label: string }[] = [
    { id: "map", icon: <Map size={20} />, label: "Map" },
    { id: "device", icon: <Satellite size={20} />, label: "Device" },
    { id: "ntrip", icon: <Radio size={20} />, label: "NTRIP" },
    { id: "settings", icon: <Settings size={20} />, label: "Settings" },
  ];

  return (
    <div className="flex h-full bg-gray-900 text-gray-100">
      {/* Left nav bar */}
      <nav className="flex flex-col w-14 bg-gray-950 border-r border-gray-800">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() =>
              setActivePanel(activePanel === item.id ? null : item.id)
            }
            className={`flex flex-col items-center justify-center py-3 text-xs gap-1 transition-colors ${
              activePanel === item.id
                ? "bg-gray-800 text-blue-400"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
            }`}
            title={item.label}
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Side panel */}
      {activePanel && activePanel !== "map" && (
        <div className="w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          {activePanel === "device" && <DevicePanel />}
          {activePanel === "ntrip" && <NtripPanel />}
          {activePanel === "settings" && (
            <div className="p-4 text-gray-400">Settings — coming soon</div>
          )}
        </div>
      )}

      {/* Main area: map + status bar */}
      <div className="flex flex-col flex-1">
        <div className="flex-1 relative">
          <MapView />
        </div>
        <StatusBar />
      </div>
    </div>
  );
}
