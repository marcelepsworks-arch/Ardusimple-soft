import { useEffect, useState } from "react";
import { MapView } from "./components/map/MapView";
import { StatusBar } from "./components/device/StatusBar";
import { DevicePanel } from "./components/device/DevicePanel";
import { NtripPanel } from "./components/ntrip/NtripPanel";
import { CollectPanel } from "./components/collect/CollectPanel";
import { LicenseGate } from "./components/shared/LicenseGate";
import { startFixListener, startConnectionListener } from "./lib/nmea-listener";
import {
  Map,
  Crosshair,
  Satellite,
  Radio,
  Settings,
} from "lucide-react";

type Panel = "map" | "device" | "ntrip" | "survey" | "settings" | null;

const NAV_ITEMS: { id: Panel; icon: React.ReactNode; label: string }[] = [
  { id: "map",     icon: <Map size={20} />,       label: "Map" },
  { id: "device",  icon: <Satellite size={20} />, label: "Device" },
  { id: "ntrip",   icon: <Radio size={20} />,     label: "NTRIP" },
  { id: "survey",  icon: <Crosshair size={20} />, label: "Survey" },
  { id: "settings",icon: <Settings size={20} />,  label: "Settings" },
];

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

  function toggle(id: Panel) {
    setActivePanel((prev) => (prev === id ? null : id));
  }

  const panelOpen = activePanel !== null && activePanel !== "map";

  return (
    <LicenseGate>
      {/* ── DESKTOP layout (md+): left icon rail + side panel + map ── */}
      <div className="hidden md:flex flex-1 bg-gray-900 text-gray-100">
        {/* Left nav rail */}
        <nav className="flex flex-col w-14 bg-gray-950 border-r border-gray-800">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
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
        {panelOpen && (
          <div className="w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto flex-shrink-0">
            <PanelContent active={activePanel} />
          </div>
        )}

        {/* Map + status bar */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 relative">
            <MapView />
          </div>
          <StatusBar />
        </div>
      </div>

      {/* ── MOBILE layout (<md): map fills screen, bottom tab bar, slide-up panel ── */}
      <div className="flex md:hidden flex-col flex-1 bg-gray-900 text-gray-100 relative">
        {/* Map always behind */}
        <div className="absolute inset-0 bottom-[56px]">
          <MapView />
        </div>

        {/* Slide-up panel when active (not map) */}
        {panelOpen && (
          <div className="absolute inset-x-0 bottom-[56px] top-0 bg-gray-900 overflow-y-auto z-20">
            {/* Close / back bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                {NAV_ITEMS.find((n) => n.id === activePanel)?.label}
              </span>
              <button
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-gray-100 text-xs px-2 py-1"
              >
                Close ×
              </button>
            </div>
            <PanelContent active={activePanel} />
          </div>
        )}

        {/* Status bar (thin, above bottom nav) */}
        <div className="absolute inset-x-0 bottom-[56px] z-10">
          <StatusBar />
        </div>

        {/* Bottom tab bar */}
        <nav className="absolute inset-x-0 bottom-0 h-14 flex bg-gray-950 border-t border-gray-800 z-30">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`flex flex-col flex-1 items-center justify-center gap-0.5 text-[10px] transition-colors ${
                activePanel === item.id
                  ? "text-blue-400 bg-gray-800"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </LicenseGate>
  );
}

function PanelContent({ active }: { active: Panel }) {
  if (active === "device")   return <DevicePanel />;
  if (active === "ntrip")    return <NtripPanel />;
  if (active === "survey")   return <CollectPanel />;
  if (active === "settings") return <div className="p-4 text-gray-400 text-sm">Settings — coming soon</div>;
  return null;
}
