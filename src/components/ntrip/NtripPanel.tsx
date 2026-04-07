import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Radio, Download, Wifi, WifiOff } from "lucide-react";

interface MountpointInfo {
  name: string;
  identifier: string;
  format: string;
  details: string;
  latitude: number;
  longitude: number;
  country: string;
}

interface NtripStatus {
  connected: boolean;
  bytes_received: number;
  bytes_per_second: number;
}

export function NtripPanel() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(2101);
  const [mountpoint, setMountpoint] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connected, setConnected] = useState(false);
  const [mountpoints, setMountpoints] = useState<MountpointInfo[]>([]);
  const [fetching, setFetching] = useState(false);
  const [status, setStatus] = useState<NtripStatus | null>(null);
  const [error, setError] = useState("");

  // Listen for NTRIP state and status events
  useEffect(() => {
    const unsubs = [
      listen<{ connected: boolean }>("ntrip_state", (e) => {
        setConnected(e.payload.connected);
        if (!e.payload.connected) setStatus(null);
      }),
      listen<NtripStatus>("ntrip_status", (e) => {
        setStatus(e.payload);
      }),
    ];
    return () => {
      unsubs.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  async function fetchSourcetable() {
    if (!host) return;
    setFetching(true);
    setError("");
    try {
      const result = await invoke<MountpointInfo[]>("ntrip_fetch_sourcetable", {
        host,
        port,
      });
      setMountpoints(result);
      if (result.length > 0 && !mountpoint) {
        setMountpoint(result[0].name);
      }
    } catch (e) {
      setError(String(e));
    }
    setFetching(false);
  }

  async function connect() {
    setError("");
    try {
      await invoke("ntrip_connect", {
        host,
        port,
        mountpoint,
        username,
        password,
      });
    } catch (e) {
      setError(String(e));
    }
  }

  async function disconnect() {
    try {
      await invoke("ntrip_disconnect");
    } catch (e) {
      setError(String(e));
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        NTRIP Client
      </h2>

      {/* Status indicator */}
      {connected && status && (
        <div className="bg-green-900/30 border border-green-800 rounded p-3 space-y-1">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <Wifi size={14} /> Connected
          </div>
          <div className="text-xs text-gray-300 space-y-0.5">
            <div>Received: {formatBytes(status.bytes_received)}</div>
            <div>Rate: {formatBytes(status.bytes_per_second)}/s</div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded p-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Host + Port */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Caster Host</label>
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="e.g., ntrip.example.com"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
          disabled={connected}
        />
      </div>

      <div className="flex gap-2">
        <div className="w-24 space-y-1">
          <label className="text-xs text-gray-400">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
            disabled={connected}
          />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400">Mountpoint</label>
            <button
              onClick={fetchSourcetable}
              disabled={fetching || connected || !host}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Download size={10} />
              {fetching ? "Fetching..." : "Get List"}
            </button>
          </div>
          {mountpoints.length > 0 ? (
            <select
              value={mountpoint}
              onChange={(e) => setMountpoint(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
              disabled={connected}
            >
              {mountpoints.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} — {m.format} ({m.country})
                </option>
              ))}
            </select>
          ) : (
            <input
              value={mountpoint}
              onChange={(e) => setMountpoint(e.target.value)}
              placeholder="mountpoint name"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
              disabled={connected}
            />
          )}
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
          disabled={connected}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
          disabled={connected}
        />
      </div>

      {/* Connect / Disconnect */}
      <button
        onClick={connected ? disconnect : connect}
        disabled={!connected && (!host || !mountpoint)}
        className={`w-full py-2 rounded text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 ${
          connected
            ? "bg-red-600 hover:bg-red-700"
            : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {connected ? (
          <>
            <WifiOff size={16} /> Disconnect NTRIP
          </>
        ) : (
          <>
            <Radio size={16} /> Connect NTRIP
          </>
        )}
      </button>
    </div>
  );
}
