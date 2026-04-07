import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {useNtripStore} from '../store/useNtripStore';
import {ntripService} from '../services/ntrip-service';
import {formatBytes} from '../lib/formats';

export function NtripScreen() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('2101');
  const [mountpoint, setMountpoint] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);

  const connected = useNtripStore(s => s.connected);
  const bytesReceived = useNtripStore(s => s.bytesReceived);
  const bytesPerSecond = useNtripStore(s => s.bytesPerSecond);

  async function connect() {
    if (!host || !mountpoint) {
      Alert.alert('Missing fields', 'Host and mountpoint are required.');
      return;
    }
    setConnecting(true);
    try {
      await ntripService.connect(
        host,
        parseInt(port, 10) || 2101,
        mountpoint,
        username,
        password,
      );
    } catch (e) {
      Alert.alert('NTRIP Error', String(e));
    }
    setConnecting(false);
  }

  function disconnect() {
    ntripService.disconnect();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status card */}
      {connected && (
        <View style={styles.statusCard}>
          <Text style={styles.connectedText}>NTRIP Connected</Text>
          <View style={styles.statsRow}>
            <Text style={styles.stat}>Received: {formatBytes(bytesReceived)}</Text>
            <Text style={styles.stat}>Rate: {formatBytes(bytesPerSecond)}/s</Text>
          </View>
        </View>
      )}

      {/* Form */}
      <Text style={styles.label}>Caster Host</Text>
      <TextInput
        style={styles.input}
        value={host}
        onChangeText={setHost}
        placeholder="ntrip.example.com"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        editable={!connected}
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Port</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            keyboardType="numeric"
            editable={!connected}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Mountpoint</Text>
          <TextInput
            style={styles.input}
            value={mountpoint}
            onChangeText={setMountpoint}
            autoCapitalize="none"
            editable={!connected}
          />
        </View>
      </View>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        editable={!connected}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!connected}
      />

      <TouchableOpacity
        style={[styles.btn, connected ? styles.btnDanger : styles.btnSuccess]}
        onPress={connected ? disconnect : connect}
        disabled={connecting}>
        <Text style={styles.btnText}>
          {connecting
            ? 'Connecting...'
            : connected
              ? 'Disconnect NTRIP'
              : 'Connect NTRIP'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 16,
    gap: 8,
  },
  statusCard: {
    backgroundColor: '#064e3b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 6,
  },
  connectedText: {
    color: '#34d399',
    fontWeight: '700',
    fontSize: 15,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    color: '#d1d5db',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnSuccess: {
    backgroundColor: '#16a34a',
  },
  btnDanger: {
    backgroundColor: '#dc2626',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
