import { listen } from "@tauri-apps/api/event";
import { useDeviceStore } from "../store/useDeviceStore";

export async function startFixListener() {
  return listen<{
    latitude: number;
    longitude: number;
    altitude: number;
    fix_type: string;
    fix_quality: number;
    hdop: number;
    sats_used: number;
    age_of_corrections: number;
    speed_knots: number;
    course: number;
    timestamp: string;
  }>("fix_update", (event) => {
    useDeviceStore.getState().setLiveFix(event.payload);
  });
}

export async function startConnectionListener() {
  return listen<{ state: "connected" | "disconnected" | "error"; reason?: string }>(
    "connection_state",
    (event) => {
      useDeviceStore.getState().setConnectionState(event.payload.state);
      if (event.payload.state === "disconnected") {
        useDeviceStore.getState().setConnectedPort(null);
        if (event.payload.reason) {
          useDeviceStore.getState().setLastError(event.payload.reason);
        }
      }
    }
  );
}
