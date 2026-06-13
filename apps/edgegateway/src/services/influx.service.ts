import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';

/**
 * Writes tag history to the SAME `mes_timeseries` InfluxDB bucket the platform
 * uses. Degrades gracefully: when Influx is unreachable, `write` returns false
 * and the caller buffers the point to disk for later replay.
 * (Mirrors apps/api/src/modules/historian/influx.service.ts.)
 */
@Injectable()
export class InfluxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfluxService.name);
  private writeApi: WriteApi | null = null;
  private org = 'star-mes';
  private bucket = 'mes_timeseries';
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('influx.url');
    const token = this.config.get<string>('influx.token');
    this.org = this.config.get<string>('influx.org') ?? 'star-mes';
    this.bucket = this.config.get<string>('influx.bucket') ?? 'mes_timeseries';

    if (!url || !token) {
      this.logger.warn('InfluxDB not configured — history disabled.');
      return;
    }
    try {
      const client = new InfluxDB({ url, token });
      this.writeApi = client.getWriteApi(this.org, this.bucket, 'ms');
      this.enabled = true;
      this.logger.log(`InfluxDB connected → ${url} (bucket=${this.bucket})`);
    } catch (err) {
      this.logger.error('Failed to init InfluxDB client', err as Error);
    }
  }

  async onModuleDestroy() {
    try { await this.writeApi?.close(); } catch { /* ignore */ }
  }

  isEnabled() {
    return this.enabled;
  }

  async write(points: Point | Point[]): Promise<boolean> {
    if (!this.enabled || !this.writeApi) return false;
    try {
      const arr = Array.isArray(points) ? points : [points];
      if (!arr.length) return true;
      this.writeApi.writePoints(arr);
      await this.writeApi.flush();
      return true;
    } catch (err) {
      this.logger.error('Influx write failed', err as Error);
      return false;
    }
  }
}

export { Point };
