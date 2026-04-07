import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDeviceStore, PortInfo } from "../../store/useDeviceStore";
import { Usb, Bluetooth, RefreshCw, Plug, Unplug } from "lucide-react";

const BAUD_OPTIONS = [4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800];

export function DevicePanel() {
  const ports = useDeviceStore((s) => s.ports);
  const setPorts = useDeviceStore((s) => s.setPorts);
  const connectedPort = useDeviceStore((s) => s.connectedPort);
  const setConnectedPort = useDeviceStore((s) => s.setConnectedPort);
  const connectionState = useDeviceStore((s) => s.connectionState);
  const [selectedPort, setSelectedPort] = useState("");
  const [baudRate, setBaudRate] = useState(115200);
  const [scanning, setScanning] = useState(false);

  async function scanPorts() {
    setScanning(true);
    try {
      const result = await invoke<PortInfo[]>("list_serial_ports");
      setPorts(result);
      if (result.length > 0 && !selectedPort) {
        setSelectedPort(result[0].name);
      }
    } catch (e) {
      console.error("Failed to scan ports:", e);
    }
    setScanning(false);
  }

  useEffect(() => {
    scanPorts();
  }, []);

  async function connect() {
    if (!selectedPort) return;
    try {
      await invoke("connect_serial", { port: selectedPort, baud: baudRate });
      setConnectedPort(selectedPort);
    } catch (e) {
      console.error("Connect failed:", e);
    }
  }

  async function disconnect() {
    try {
      await invoke("disconnect");
      setConnectedPort(null);
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  }

  const isConnected = connectionState === "connected";

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Device Connection
      </h2>

      {/* Port scanner */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">Serial Port</label>
          <button
            onClick={scanPorts}
            disabled={scanning}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
            Scan
          </button>
        </div>
        <select
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
          disabled={isConnected}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
        >
          {ports.length === 0 && <option value="">No ports found</option>}
          {ports.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} — {p.description || "Unknown"} {p.chipset && `(${p.chipset})`}
            </option>
          ))}
        </select>
      </div>

      {/* Baud rate */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Baud Rate</label>
        <select
          value={baudRate}
          onChange={(e) => setBaudRate(Number(e.target.value))}
          disabled={isConnected}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
        >
          {BAUD_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Connect / Disconnect */}
      <button
        onClick={isConnected ? disconnect : connect}
        className={`w-full py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${
          isConnected
            ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {isConnected ? (
          <>
            <Unplug size={16} /> Disconnect
          </>
        ) : (
          <>
            <Plug size={16} /> Connect
          </>
        )}
      </button>

      {/* Quick connect presets */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400 uppercase tracking-wider">
          Quick Connect
        </label>
        {[
          { label: "ArduSimple USB", baud: 115200 },
          { label: "Custom 9600", baud: 9600 },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              setBaudRate(preset.baud);
              // auto-select first GNSS port if available
              const gnss = ports.find(
                (p) =>
                  p.description.toLowerCase().includes("u-blox") ||
                  p.description.toLowerCase().includes("cp210") ||
                  p.description.toLowerCase().includes("ftdi") ||
                  p.chipset.toLowerCase().includes("ardusimple")
              );
              if (gnss) setSelectedPort(gnss.name);
            }}
            disabled={isConnected}
            className="w-full text-left px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-750 rounded border border-gray-700"
          >
            {preset.label} ({preset.baud})
          </button>
        ))}
      </div>
    </div>
  );
}
