import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Radio } from "lucide-react";

export function NtripPanel() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(2101);
  const [mountpoint, setMountpoint] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connected, setConnected] = useState(false);

  async function connect() {
    try {
      await invoke("ntrip_connect", {
        host,
        port,
        mountpoint,
        username,
        password,
      });
      setConnected(true);
    } catch (e) {
      console.error("NTRIP connect failed:", e);
    }
  }

  async function disconnect() {
    try {
      await invoke("ntrip_disconnect");
      setConnected(false);
    } catch (e) {
      console.error("NTRIP disconnect failed:", e);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        NTRIP Client
      </h2>

      <div className="space-y-2">
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
        <div className="flex-1 space-y-1">
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
          <label className="text-xs text-gray-400">Mountpoint</label>
          <input
            value={mountpoint}
            onChange={(e) => setMountpoint(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
            disabled={connected}
          />
        </div>
      </div>

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

      <button
        onClick={connected ? disconnect : connect}
        className={`w-full py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${
          connected
            ? "bg-red-600 hover:bg-red-700"
            : "bg-green-600 hover:bg-green-700"
        }`}
      >
        <Radio size={16} />
        {connected ? "Disconnect NTRIP" : "Connect NTRIP"}
      </button>
    </div>
  );
}
