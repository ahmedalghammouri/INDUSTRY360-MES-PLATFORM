import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';

/**
 * Thin wrapper around the InfluxDB 2.x time-series database (the `mes_timeseries`
 * bucket provisioned in docker-compose). All shop-floor / OEE history is persisted
 * here as real timestamped points — this is the project's historian / TSDB.
 *
 * Degrades gracefully: if Influx is unreachable or unconfigured, writes/queries
 * become no-ops and the rest of the app keeps working (the relational fallbacks
 * still serve current values).
 */
@Injectable()
export class InfluxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfluxService.name);
  private client: InfluxDB | null = null;
  private writeApi: WriteApi | null = null;
  private queryApi: QueryApi | null = null;
  private org = 'star-mes';
  private bucket = 'mes_timeseries';
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('influx.url') ?? process.env.INFLUX_URL;
    const token = this.config.get<string>('influx.token') ?? process.env.INFLUX_TOKEN;
    this.org = this.config.get<string>('influx.org') ?? process.env.INFLUX_ORG ?? 'star-mes';
    this.bucket = this.config.get<string>('influx.bucket') ?? process.env.INFLUX_BUCKET ?? 'mes_timeseries';

    if (!url || !token) {
      this.logger.warn('InfluxDB not configured (INFLUX_URL / INFLUX_TOKEN missing) — historian disabled.');
      return;
    }
    try {
      this.client = new InfluxDB({ url, token });
      this.writeApi = this.client.getWriteApi(this.org, this.bucket, 'ms');
      this.queryApi = this.client.getQueryApi(this.org);
      this.enabled = true;
      this.logger.log(`InfluxDB historian connected → ${url} (org=${this.org}, bucket=${this.bucket})`);
    } catch (err) {
      this.logger.error('Failed to init InfluxDB client — historian disabled.', err as any);
    }
  }

  async onModuleDestroy() {
    try { await this.writeApi?.close(); } catch { /* ignore */ }
  }

  isEnabled() {
    return this.enabled;
  }

  /** Write one or more points and flush. Never throws. */
  async write(points: Point | Point[]): Promise<boolean> {
    if (!this.enabled || !this.writeApi) return false;
    try {
      const arr = Array.isArray(points) ? points : [points];
      if (!arr.length) return true;
      this.writeApi.writePoints(arr);
      await this.writeApi.flush();
      return true;
    } catch (err) {
      this.logger.error('Influx write failed', err as any);
      return false;
    }
  }

  /** Run a Flux query and collect rows. Returns [] on any error / when disabled. */
  async query<T = any>(flux: string): Promise<T[]> {
    if (!this.enabled || !this.queryApi) return [];
    try {
      return (await this.queryApi.collectRows(flux)) as T[];
    } catch (err) {
      this.logger.error('Influx query failed', err as any);
      return [];
    }
  }

  getBucket() { return this.bucket; }
}
