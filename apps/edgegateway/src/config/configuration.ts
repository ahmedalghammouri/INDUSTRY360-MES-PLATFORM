export interface GatewayConfig {
  gatewayId: string | null;
  gatewayName: string;
  factoryCode: string | null;
  port: number;
  databaseUrl: string | undefined;
  mqtt: { brokerUrl: string | undefined };
  influx: {
    url: string | undefined;
    token: string | undefined;
    org: string;
    bucket: string;
  };
  jwtSecret: string;
  defaultPollIntervalMs: number;
  heartbeatIntervalMs: number;
  bufferDir: string;
}

export default (): GatewayConfig => ({
  gatewayId: process.env.GATEWAY_ID || null,
  gatewayName: process.env.GATEWAY_NAME || 'Edge Gateway',
  factoryCode: process.env.GATEWAY_FACTORY_CODE || null,
  port: parseInt(process.env.GATEWAY_PORT || '4900', 10),
  databaseUrl: process.env.DATABASE_URL,
  mqtt: { brokerUrl: process.env.MQTT_BROKER_URL },
  influx: {
    url: process.env.INFLUX_URL,
    token: process.env.INFLUX_TOKEN,
    org: process.env.INFLUX_ORG || 'star-mes',
    bucket: process.env.INFLUX_BUCKET || 'mes_timeseries',
  },
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production-min-32-characters',
  defaultPollIntervalMs: parseInt(process.env.DEFAULT_POLL_INTERVAL_MS || '1000', 10),
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '15000', 10),
  bufferDir: process.env.BUFFER_DIR || './buffer',
});
