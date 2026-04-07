/**
 * BLE service for connecting to ArduSimple GNSS receivers.
 *
 * ArduSimple BT modules use Bluetooth SPP (Serial Port Profile) emulated
 * over BLE using a Nordic UART Service (NUS) or similar.
 *
 * Common UUIDs:
 * - Nordic UART Service: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
 * - TX Characteristic:   6E400002-... (write RTCM to receiver)
 * - RX Characteristic:   6E400003-... (receive NMEA from receiver)
 */

import {BleManager, Device, Subscription} from 'react-native-ble-plx';
import {parseSentence, LiveFix, emptyFix} from '../lib/nmea-parser';
import {useDeviceStore} from '../store/useDeviceStore';
import {Buffer} from 'buffer';

// Nordic UART Service UUIDs (common for BLE serial modules)
const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // write to device
const NUS_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notify from device

class BleService {
  private manager: BleManager;
  private device: Device | null = null;
  private subscription: Subscription | null = null;
  private nmeaBuffer = '';
  private fix: LiveFix = emptyFix();

  constructor() {
    this.manager = new BleManager();
  }

  async startScan(): Promise<void> {
    const store = useDeviceStore.getState();
    store.setBleDevices([]);

    this.manager.startDeviceScan(null, {allowDuplicates: false}, (error, device) => {
      if (error) {
        console.error('BLE scan error:', error);
        return;
      }
      if (device && device.name) {
        store.addBleDevice({
          id: device.id,
          name: device.name || 'Unknown',
          rssi: device.rssi || -100,
        });
      }
    });

    // Stop scan after 15 seconds
    setTimeout(() => this.stopScan(), 15000);
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  async connect(deviceId: string): Promise<void> {
    const store = useDeviceStore.getState();
    store.setConnectionState('connecting');
    this.stopScan();

    try {
      const device = await this.manager.connectToDevice(deviceId, {
        requestMTU: 512,
      });
      await device.discoverAllServicesAndCharacteristics();
      this.device = device;

      store.setConnectedDeviceId(deviceId);
      store.setConnectionState('connected');

      // Start listening for NMEA data
      this.startNmeaListener();

      // Monitor disconnection
      this.manager.onDeviceDisconnected(deviceId, () => {
        store.setConnectionState('disconnected');
        store.setConnectedDeviceId(null);
        this.device = null;
      });
    } catch (error) {
      console.error('BLE connect error:', error);
      store.setConnectionState('error');
    }
  }

  private startNmeaListener(): void {
    if (!this.device) return;

    this.subscription = this.device.monitorCharacteristicForService(
      NUS_SERVICE_UUID,
      NUS_RX_CHAR_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('NMEA monitor error:', error);
          return;
        }
        if (characteristic?.value) {
          const data = Buffer.from(characteristic.value, 'base64').toString('ascii');
          this.processNmeaChunk(data);
        }
      },
    );
  }

  private processNmeaChunk(chunk: string): void {
    this.nmeaBuffer += chunk;

    // Split by newline and process complete sentences
    const lines = this.nmeaBuffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.nmeaBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('$')) {
        if (parseSentence(trimmed, this.fix)) {
          useDeviceStore.getState().setLiveFix({...this.fix});
        }
      }
    }
  }

  /** Write RTCM correction data to the receiver */
  async writeRtcm(data: Uint8Array): Promise<void> {
    if (!this.device) return;

    const b64 = Buffer.from(data).toString('base64');

    // BLE has a max write size (~512 bytes with MTU negotiation).
    // Split into chunks if needed.
    const chunkSize = 500;
    for (let i = 0; i < b64.length; i += chunkSize) {
      const chunk = b64.substring(i, i + chunkSize);
      try {
        await this.device.writeCharacteristicWithoutResponseForService(
          NUS_SERVICE_UUID,
          NUS_TX_CHAR_UUID,
          chunk,
        );
      } catch (e) {
        console.error('RTCM write error:', e);
        break;
      }
    }
  }

  async disconnect(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;

    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch {
        // Already disconnected
      }
      this.device = null;
    }

    const store = useDeviceStore.getState();
    store.setConnectionState('disconnected');
    store.setConnectedDeviceId(null);
    this.fix = emptyFix();
  }

  destroy(): void {
    this.disconnect();
    this.manager.destroy();
  }
}

export const bleService = new BleService();
