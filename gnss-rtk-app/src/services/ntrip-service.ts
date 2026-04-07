/**
 * NTRIP client service.
 * Connects to an NTRIP caster via TCP, receives RTCM corrections,
 * and relays them to the GNSS receiver via BLE.
 */

import TcpSocket from 'react-native-tcp-socket';
import {Buffer} from 'buffer';
import {generateGGA} from '../lib/nmea-parser';
import {useNtripStore} from '../store/useNtripStore';
import {useDeviceStore} from '../store/useDeviceStore';
import {bleService} from './ble-service';

class NtripService {
  private socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
  private ggaInterval: ReturnType<typeof setInterval> | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private totalBytes = 0;
  private intervalBytes = 0;

  async connect(
    host: string,
    port: number,
    mountpoint: string,
    username: string,
    password: string,
  ): Promise<void> {
    // Disconnect existing
    this.disconnect();

    const store = useNtripStore.getState();
    this.totalBytes = 0;
    this.intervalBytes = 0;

    return new Promise((resolve, reject) => {
      const socket = TcpSocket.createConnection(
        {host, port, tls: false},
        () => {
          // Send NTRIP request
          const credentials = Buffer.from(`${username}:${password}`).toString('base64');
          const request =
            `GET /${mountpoint} HTTP/1.1\r\n` +
            `Host: ${host}\r\n` +
            `User-Agent: NTRIP GNSSRTKApp/1.0\r\n` +
            `Authorization: Basic ${credentials}\r\n` +
            `Ntrip-Version: Ntrip/2.0\r\n` +
            `\r\n`;
          socket.write(request);
        },
      );

      let headerReceived = false;
      let headerBuffer = '';

      socket.on('data', (data: any) => {
        const buf: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

        if (!headerReceived) {
          headerBuffer += buf.toString('ascii');
          if (headerBuffer.includes('\r\n\r\n')) {
            headerReceived = true;
            // Check response
            const firstLine = headerBuffer.split('\r\n')[0];
            if (!firstLine.includes('200')) {
              store.setConnected(false);
              socket.destroy();
              reject(new Error(`NTRIP rejected: ${firstLine}`));
              return;
            }
            store.setConnected(true);
            this.startGGASender();
            this.startStats();
            resolve();

            // Process any RTCM data after the header
            const headerEnd = headerBuffer.indexOf('\r\n\r\n') + 4;
            const remaining = buf.slice(
              buf.length - (headerBuffer.length - headerEnd),
            );
            if (remaining.length > 0) {
              this.relayRtcm(remaining);
            }
          }
          return;
        }

        this.relayRtcm(buf);
      });

      socket.on('error', (err: Error) => {
        console.error('NTRIP socket error:', err);
        this.handleDisconnect();
        if (!headerReceived) {
          reject(err);
        }
      });

      socket.on('close', () => {
        this.handleDisconnect();
      });

      this.socket = socket;
    });
  }

  private relayRtcm(data: Buffer): void {
    this.totalBytes += data.length;
    this.intervalBytes += data.length;
    useNtripStore.getState().setBytesReceived(this.totalBytes);

    // Relay to BLE receiver
    bleService.writeRtcm(new Uint8Array(data));
  }

  private startGGASender(): void {
    this.ggaInterval = setInterval(() => {
      if (!this.socket) return;
      const fix = useDeviceStore.getState().liveFix;
      if (fix.latitude !== 0 && fix.longitude !== 0) {
        const gga = generateGGA(fix);
        this.socket.write(gga);
      }
    }, 10000);
  }

  private startStats(): void {
    this.statsInterval = setInterval(() => {
      useNtripStore.getState().setBytesPerSecond(this.intervalBytes);
      this.intervalBytes = 0;
    }, 1000);
  }

  private handleDisconnect(): void {
    useNtripStore.getState().setConnected(false);
    useNtripStore.getState().setBytesPerSecond(0);
    this.cleanup();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.handleDisconnect();
  }

  private cleanup(): void {
    if (this.ggaInterval) {
      clearInterval(this.ggaInterval);
      this.ggaInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
}

export const ntripService = new NtripService();
