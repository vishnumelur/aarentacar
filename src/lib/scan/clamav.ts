import { Socket } from 'node:net';
import { env } from '@/lib/env';

/**
 * Minimal clamd TCP client (Plan #13, Task 7).
 *
 * Speaks the clamd INSTREAM protocol: send `zINSTREAM\0`, then a sequence of
 * 4-byte big-endian length-prefixed chunks, terminated by a zero-length chunk.
 * clamd replies with `stream: OK` (clean) or `stream: <Name> FOUND` (infected).
 *
 * This module is the real IO. The scan-job handler
 * (src/lib/jobs/handlers/scan-uploaded-file.ts) takes a `Scanner` function as an
 * injected dependency so the decision logic is unit-testable with a fake
 * scanner — no real clamd needed in CI.
 */

export interface ScanResult {
  clean: boolean;
  /** Signature name when infected (e.g. `Eicar-Test-Signature`). */
  signature?: string;
}

/** A function that scans a byte buffer and resolves to a {@link ScanResult}. */
export type Scanner = (buf: Buffer) => Promise<ScanResult>;

const CHUNK_SIZE = 64 * 1024;

/**
 * Scan a buffer against a clamd daemon over TCP using the INSTREAM command.
 * Defaults to the `clamav:3310` service on the production `internal` network;
 * override with CLAMAV_HOST / CLAMAV_PORT.
 *
 * verify-on-deploy: requires the clamav container (signature DB downloaded).
 */
export function scanBufferOverTcp(
  buf: Buffer,
  opts: { host?: string; port?: number; timeoutMs?: number } = {},
): Promise<ScanResult> {
  const host = opts.host ?? process.env.CLAMAV_HOST ?? 'clamav';
  const port = opts.port ?? Number(process.env.CLAMAV_PORT ?? 3310);
  const timeoutMs = opts.timeoutMs ?? 30_000;

  return new Promise<ScanResult>((resolve, reject) => {
    const socket = new Socket();
    let response = '';
    let settled = false;

    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn();
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish(() => reject(new Error('clamd scan timed out'))));
    socket.on('error', (err) => finish(() => reject(err)));
    socket.on('data', (d: Buffer) => {
      response += d.toString('utf8');
    });
    socket.on('close', () =>
      finish(() => {
        const line = response.trim();
        if (/\bOK$/.test(line) && !/FOUND$/.test(line)) {
          resolve({ clean: true });
        } else if (/FOUND$/.test(line)) {
          // Format: `stream: <signature> FOUND`
          const m = line.match(/stream:\s*(.+)\s+FOUND$/);
          resolve({ clean: false, signature: m?.[1] ?? 'unknown' });
        } else {
          reject(new Error(`unexpected clamd response: ${line || '<empty>'}`));
        }
      }),
    );

    socket.connect(port, host, () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
        const chunk = buf.subarray(offset, offset + CHUNK_SIZE);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }
      // Zero-length chunk terminates the stream.
      const end = Buffer.alloc(4);
      end.writeUInt32BE(0, 0);
      socket.write(end);
    });
  });
}

/** The default production scanner (bound to env config). */
export const tcpScanner: Scanner = (buf) => scanBufferOverTcp(buf);

/** Convenience re-export so callers can read the configured endpoint for logs. */
export function clamavEndpoint(): string {
  void env; // keep env import meaningful for future config validation
  return `${process.env.CLAMAV_HOST ?? 'clamav'}:${process.env.CLAMAV_PORT ?? '3310'}`;
}
