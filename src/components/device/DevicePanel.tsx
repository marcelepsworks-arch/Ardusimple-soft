import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDeviceStore, PortInfo } from "../../store/useDeviceStore";
import { Usb, RefreshCw, Plug, Unplug, Wifi } from "lucide-react";

const BAUD_OPTIONS = [4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800];
type Transport = "serial" | "tcp";

export function DevicePanel() {
  const ports = useDeviceStore((s) => s.ports);
  const setPorts = useDeviceStore((s) => s.setPorts);
  const connectedPort = useDeviceStore((s) => s.connectedPort);
  const setConnectedPort = useDeviceStore((s) => s.setConnectedPort);
  const connectionState = useDeviceStore((s) => s.connectionState);
  const lastError = useDeviceStore((s) => s.lastError);
  const setLastError = useDeviceStore((s) => s.setLastError);

  const [transport, setTransport] = useState<Transport>("serial");
  const [selectedPort, setSelectedPort] = useState("");
  const [baudRate, setBaudRate] = useState(115200);
  const [tcpHost, setTcpHost] = useState("192.168.4.1");
  const [tcpPort, setTcpPort] = useState(9999);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => { scanPorts(); }, []);

  async function connect() {
    setError(null);
    setLastError(null);
    try {
      if (transport === "serial") {
        if (!selectedPort) return;
        await invoke("connect_serial", { port: selectedPort, baud: baudRate });
        setConnectedPort(selectedPort);
      } else {
        await invoke("connect_tcp", { host: tcpHost, port: tcpPort });
        setConnectedPort(`${tcpHost}:${tcpPort}`);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function disconnect() {
    try {
      if (transport === "serial") {
        await invoke("disconnect");
      } else {
        await invoke("disconnect_tcp");
      }
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

      {/* Transport toggle */}
      <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
        <button
          onClick={() => setTransport("serial")}
          disabled={isConnected}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${
            transport === "serial" ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-750"
          }`}
        >
          <Usb size={12} /> USB / Serial
        </button>
        <button
          onClick={() => setTransport("tcp")}
          disabled={isConnected}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${
            transport === "tcp" ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-750"
          }`}
        >
          <Wifi size={12} /> TCP / WiFi
        </button>
      </div>

      {/* Serial fields */}
      {transport === "serial" && (
        <>
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

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Baud Rate</label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={isConnected}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
            >
              {BAUD_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Quick presets */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Quick Connect</label>
            {[
              { label: "ArduSimple USB", baud: 115200 },
              { label: "u-blox 9600", baud: 9600 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setBaudRate(preset.baud);
                  const gnss = ports.find((p) =>
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
        </>
      )}

      {/* TCP fields */}
      {transport === "tcp" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Host / IP</label>
            <input
              value={tcpHost}
              onChange={(e) => setTcpHost(e.target.value)}
              disabled={isConnected}
              placeholder="192.168.4.1"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Port</label>
            <input
              type="number"
              value={tcpPort}
              onChange={(e) => setTcpPort(Number(e.target.value))}
              disabled={isConnected}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
          {/* TCP quick presets */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Presets</label>
            {[
              { label: "ArduSimple WiFi AP", host: "192.168.4.1", port: 9999 },
              { label: "GNSS Bluetooth bridge", host: "192.168.0.100", port: 5005 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => { setTcpHost(p.host); setTcpPort(p.port); }}
                disabled={isConnected}
                className="w-full text-left px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-750 rounded border border-gray-700"
              >
                {p.label} — {p.host}:{p.port}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {(error || lastError) && (
        <div className="text-xs text-red-400 bg-red-900/30 border border-red-800 rounded px-2 py-1.5 space-y-1">
          <p>{error || lastError}</p>
          {(error || lastError || "").includes("Access is denied") && (
            <p className="text-red-300">
              Another program (u-center, Arduino IDE…) is using this port. Close it and try again.
            </p>
          )}
        </div>
      )}

      {/* Connect / Disconnect */}
      <button
        onClick={isConnected ? disconnect : connect}
        className={`w-full py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${
          isConnected
            ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {isConnected ? <><Unplug size={16} /> Disconnect</> : <><Plug size={16} /> Connect</>}
      </button>

      {connectedPort && isConnected && (
        <p className="text-[10px] text-green-400 text-center">
          Connected · {connectedPort}
        </p>
      )}
    </div>
  );
}
