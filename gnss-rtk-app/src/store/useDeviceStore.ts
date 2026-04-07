import {create} from 'zustand';
import {LiveFix, emptyFix} from '../lib/nmea-parser';

export interface BleDevice {
  id: string;
  name: string;
  rssi: number;
}

interface DeviceState {
  // BLE
  bleDevices: BleDevice[];
  connectedDeviceId: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  // Position
  liveFix: LiveFix;
  // Actions
  setBleDevices: (devices: BleDevice[]) => void;
  addBleDevice: (device: BleDevice) => void;
  setConnectedDeviceId: (id: string | null) => void;
  setConnectionState: (
    state: 'disconnected' | 'connecting' | 'connected' | 'error',
  ) => void;
  setLiveFix: (fix: LiveFix) => void;
}

export const useDeviceStore = create<DeviceState>(set => ({
  bleDevices: [],
  connectedDeviceId: null,
  connectionState: 'disconnected',
  liveFix: emptyFix(),
  setBleDevices: devices => set({bleDevices: devices}),
  addBleDevice: device =>
    set(state => {
      const exists = state.bleDevices.find(d => d.id === device.id);
      if (exists) {
        return {
          bleDevices: state.bleDevices.map(d =>
            d.id === device.id ? device : d,
          ),
        };
      }
      return {bleDevices: [...state.bleDevices, device]};
    }),
  setConnectedDeviceId: id => set({connectedDeviceId: id}),
  setConnectionState: connectionState => set({connectionState}),
  setLiveFix: liveFix => set({liveFix}),
}));
