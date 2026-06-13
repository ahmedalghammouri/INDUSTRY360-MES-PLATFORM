import ModbusRTU from 'modbus-serial';
import type {
  ModbusTcpOptions, ReadResult, RegisterType, TagBinding, WordOrder,
} from './types';
import { applyScaling, coerce } from './scaling';

/** Combine two 16-bit registers into one 32-bit unsigned integer. */
function combine32(words: number[], order: WordOrder = 'BIG'): number {
  const [a, b] = order === 'BIG' ? [words[0], words[1]] : [words[1], words[0]];
  return (a << 16 >>> 0) + (b & 0xffff);
}

/**
 * Thin, reconnecting Modbus-TCP client wrapping `modbus-serial`. One instance
 * per device. Reads any register class and assembles 16/32-bit values; callers
 * apply per-tag scaling/coercion via {@link readTag}.
 */
export class ModbusTcpClient {
  private client = new ModbusRTU();
  private connected = false;
  private connecting: Promise<void> | null = null;

  constructor(private readonly opts: ModbusTcpOptions) {}

  isConnected(): boolean {
    return this.connected;
  }

  /** Connect (idempotent). Concurrent callers share one in-flight attempt. */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      this.client = new ModbusRTU();
      this.client.setTimeout(this.opts.timeoutMs ?? 3000);
      await this.client.connectTCP(this.opts.host, { port: this.opts.port ?? 502 });
      this.client.setID(this.opts.unitId ?? 1);
      this.connected = true;
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    await new Promise<void>((resolve) => {
      try { this.client.close(() => resolve()); } catch { resolve(); }
    });
  }

  /** Low-level read of `count` units of a register class starting at `address`. */
  private async readRaw(registerType: RegisterType, address: number, count: number): Promise<number[] | boolean[]> {
    switch (registerType) {
      case 'HOLDING':  return (await this.client.readHoldingRegisters(address, count)).data;
      case 'INPUT':    return (await this.client.readInputRegisters(address, count)).data;
      case 'COIL':     return (await this.client.readCoils(address, count)).data;
      case 'DISCRETE': return (await this.client.readDiscreteInputs(address, count)).data;
      default:         throw new Error(`Unsupported register type: ${registerType}`);
    }
  }

  /**
   * Read one tag and return both the raw and scaled/coerced value with quality.
   * Never throws — a failed read yields `{ raw: null, value: null, quality: 'BAD' }`
   * and flips the connection to disconnected so the poller can reconnect.
   */
  async readTag(tag: TagBinding): Promise<ReadResult> {
    const timestamp = new Date();
    try {
      if (!this.connected) await this.connect();
      const isBit = tag.registerType === 'COIL' || tag.registerType === 'DISCRETE';
      const count = isBit ? 1 : Math.max(1, tag.wordCount ?? 1);
      const data = await this.readRaw(tag.registerType, tag.address, count);

      let raw: number | boolean | null;
      if (isBit) {
        raw = Boolean((data as boolean[])[0]);
      } else if (count === 2) {
        raw = combine32(data as number[], tag.wordOrder ?? 'BIG');
      } else {
        raw = (data as number[])[0] ?? null;
      }

      const scaled = applyScaling(raw, { scaleFactor: tag.scaleFactor, offset: tag.offset });
      const value = coerce(scaled, tag.dataType);
      return { raw, value, quality: 'GOOD', timestamp };
    } catch {
      this.connected = false;
      return { raw: null, value: null, quality: 'BAD', timestamp };
    }
  }
}
