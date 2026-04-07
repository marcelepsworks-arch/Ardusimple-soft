import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {useDeviceStore, BleDevice} from '../store/useDeviceStore';
import {bleService} from '../services/ble-service';
import {fixTypeColor} from '../lib/formats';

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android' && Platform.Version >= 31) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(granted).every(
      v => v === PermissionsAndroid.RESULTS.GRANTED,
    );
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function DeviceScreen() {
  const devices = useDeviceStore(s => s.bleDevices);
  const connState = useDeviceStore(s => s.connectionState);
  const connectedId = useDeviceStore(s => s.connectedDeviceId);
  const fix = useDeviceStore(s => s.liveFix);
  const [scanning, setScanning] = useState(false);

  async function startScan() {
    const ok = await requestBlePermissions();
    if (!ok) {
      Alert.alert('Permission Required', 'Bluetooth permissions are needed to scan for GNSS receivers.');
      return;
    }
    setScanning(true);
    useDeviceStore.getState().setBleDevices([]);
    await bleService.startScan();
    setTimeout(() => setScanning(false), 15000);
  }

  async function connectDevice(device: BleDevice) {
    try {
      await bleService.connect(device.id);
    } catch (e) {
      Alert.alert('Connection Failed', String(e));
    }
  }

  async function disconnect() {
    await bleService.disconnect();
  }

  const isConnected = connState === 'connected';

  return (
    <View style={styles.container}>
      {/* Connection status */}
      {isConnected && (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Connected</Text>
          <View style={styles.fixRow}>
            <Text style={[styles.fixBadge, {
              backgroundColor: fixTypeColor(fix.fixQuality) + '33',
              color: fixTypeColor(fix.fixQuality),
            }]}>
              {fix.fixType}
            </Text>
            <Text style={styles.statText}>Sats: {fix.satsUsed}</Text>
            <Text style={styles.statText}>HDOP: {fix.hdop.toFixed(1)}</Text>
          </View>
          <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scan controls */}
      {!isConnected && (
        <>
          <TouchableOpacity
            style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
            onPress={startScan}
            disabled={scanning}>
            {scanning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : null}
            <Text style={styles.scanBtnText}>
              {scanning ? 'Scanning...' : 'Scan for Devices'}
            </Text>
          </TouchableOpacity>

          <FlatList
            data={devices}
            keyExtractor={item => item.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {scanning
                  ? 'Searching for Bluetooth GNSS receivers...'
                  : 'Tap "Scan" to find nearby devices'}
              </Text>
            }
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.deviceItem}
                onPress={() => connectDevice(item)}>
                <View>
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceId}>{item.id}</Text>
                </View>
                <Text style={styles.rssi}>{item.rssi} dBm</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {connState === 'connecting' && (
        <View style={styles.connectingOverlay}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={styles.connectingText}>Connecting...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statusTitle: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '700',
  },
  fixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fixBadge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statText: {
    color: '#9ca3af',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  disconnectBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  disconnectText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  scanBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  scanBtnDisabled: {
    opacity: 0.7,
  },
  scanBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  deviceItem: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceName: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  deviceId: {
    color: '#6b7280',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  rssi: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  connectingText: {
    color: '#d1d5db',
    fontSize: 16,
  },
});
