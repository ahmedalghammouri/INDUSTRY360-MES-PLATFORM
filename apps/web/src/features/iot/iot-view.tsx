'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  Radio,
  Activity,
  Cpu,
  Signal,
  RefreshCw,
  Plus,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface IoTDevice {
  id: string;
  name: string;
  protocol: 'MQTT' | 'OPC-UA' | 'Modbus';
  host: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  equipment: string;
  tagsCount: number;
  lastSeen: string;
  dataRate: number;
}

interface IoTTag {
  id: string;
  name: string;
  address: string;
  value: number | string | boolean;
  unit: string;
  quality: 'GOOD' | 'BAD' | 'UNCERTAIN';
  updatedAt: string;
  device: string;
}

const MOCK_DEVICES: IoTDevice[] = [
  { id: '1', name: 'Mixer M-101 PLC', protocol: 'Modbus', host: '192.168.1.10:502', status: 'CONNECTED', equipment: 'Mixer M-101', tagsCount: 24, lastSeen: '2s ago', dataRate: 1200 },
  { id: '2', name: 'Filler F-301 OPC', protocol: 'OPC-UA', host: 'opc.tcp://192.168.1.20:4840', status: 'CONNECTED', equipment: 'Filler F-301', tagsCount: 48, lastSeen: '1s ago', dataRate: 2400 },
  { id: '3', name: 'MQTT Broker - Plant', protocol: 'MQTT', host: 'mqtt://192.168.1.100:1883', status: 'CONNECTED', equipment: 'All Equipment', tagsCount: 128, lastSeen: '500ms ago', dataRate: 5600 },
  { id: '4', name: 'Capper C-302 PLC', protocol: 'Modbus', host: '192.168.1.11:502', status: 'ERROR', equipment: 'Capper C-302', tagsCount: 16, lastSeen: '5m ago', dataRate: 0 },
  { id: '5', name: 'Blender B-201 OPC', protocol: 'OPC-UA', host: 'opc.tcp://192.168.1.21:4840', status: 'DISCONNECTED', equipment: 'Blender B-201', tagsCount: 32, lastSeen: '2h ago', dataRate: 0 },
];

const MOCK_TAGS: IoTTag[] = [
  { id: '1', name: 'Mixer Speed', address: '400001', value: 1450, unit: 'RPM', quality: 'GOOD', updatedAt: '2s ago', device: 'Mixer M-101 PLC' },
  { id: '2', name: 'Motor Temperature', address: '400002', value: 68.4, unit: '°C', quality: 'GOOD', updatedAt: '2s ago', device: 'Mixer M-101 PLC' },
  { id: '3', name: 'Running Status', address: '000001', value: true, unit: '', quality: 'GOOD', updatedAt: '2s ago', device: 'Mixer M-101 PLC' },
  { id: '4', name: 'Fill Level', address: 'ns=2;s=FillLevel', value: 73.2, unit: '%', quality: 'GOOD', updatedAt: '1s ago', device: 'Filler F-301 OPC' },
  { id: '5', name: 'Fill Rate', address: 'ns=2;s=FillRate', value: 120, unit: 'bottles/min', quality: 'GOOD', updatedAt: '1s ago', device: 'Filler F-301 OPC' },
  { id: '6', name: 'Pressure Sensor', address: '400010', value: 4.2, unit: 'bar', quality: 'UNCERTAIN', updatedAt: '30s ago', device: 'Capper C-302 PLC' },
];

const statusConfig = {
  CONNECTED: { color: 'text-green-400', bg: 'bg-green-500/20', icon: Wifi, label: 'Connected' },
  DISCONNECTED: { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: WifiOff, label: 'Disconnected' },
  ERROR: { color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertTriangle, label: 'Error' },
};

const protocolConfig = {
  MQTT: { color: 'text-purple-400', bg: 'bg-purple-500/20' },
  'OPC-UA': { color: 'text-blue-400', bg: 'bg-blue-500/20' },
  Modbus: { color: 'text-amber-400', bg: 'bg-amber-500/20' },
};

const qualityColors = {
  GOOD: 'text-green-400',
  BAD: 'text-red-400',
  UNCERTAIN: 'text-amber-400',
};

export function IoTView() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const connectedCount = MOCK_DEVICES.filter((d) => d.status === 'CONNECTED').length;
  const totalTags = MOCK_DEVICES.reduce((acc, d) => acc + d.tagsCount, 0);
  const totalRate = MOCK_DEVICES.reduce((acc, d) => acc + d.dataRate, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IIoT Device Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Industrial device connectivity — MQTT, OPC-UA, Modbus
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Device
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Connected Devices', value: `${connectedCount}/${MOCK_DEVICES.length}`, icon: Wifi, color: 'text-green-400' },
          { label: 'Total Tags', value: totalTags, icon: Radio, color: 'text-brand-400' },
          { label: 'Data Rate', value: `${(totalRate / 1000).toFixed(1)}K/s`, icon: Activity, color: 'text-cyan-400' },
          { label: 'Protocols Active', value: '3', icon: Signal, color: 'text-purple-400' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div>
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="tags">Live Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {MOCK_DEVICES.map((device, i) => {
              const statusCfg = statusConfig[device.status];
              const protoCfg = protocolConfig[device.protocol];
              const StatusIcon = statusCfg.icon;
              return (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'glass-card rounded-xl p-5 cursor-pointer transition-all',
                    selectedDevice === device.id ? 'ring-1 ring-brand-500' : 'hover:ring-1 hover:ring-white/20',
                  )}
                  onClick={() => setSelectedDevice(device.id === selectedDevice ? null : device.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', statusCfg.bg)}>
                        <StatusIcon className={cn('w-4 h-4', statusCfg.color)} />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{device.name}</div>
                        <div className="text-[11px] text-muted-foreground">{device.equipment}</div>
                      </div>
                    </div>
                    <Badge className={cn('text-[10px]', protoCfg.bg, protoCfg.color, 'border-0')}>
                      {device.protocol}
                    </Badge>
                  </div>

                  <div className="text-[11px] font-mono text-muted-foreground mb-3 truncate">
                    {device.host}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{device.tagsCount} tags</span>
                      {device.dataRate > 0 && <span>{(device.dataRate / 1000).toFixed(1)}K/s</span>}
                    </div>
                    <div className={cn('flex items-center gap-1', statusCfg.color)}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      <span>{device.lastSeen}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs">
                      <Cpu className="w-3 h-3 mr-1" />
                      Tags
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs">
                      <Settings className="w-3 h-3 mr-1" />
                      Config
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="tags" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Tag Name</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Address</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Value</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Quality</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Device</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TAGS.map((tag) => (
                  <tr key={tag.id} className="border-b border-border/50 hover:bg-white/5">
                    <td className="p-4 font-medium">{tag.name}</td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">{tag.address}</td>
                    <td className="p-4 text-right font-mono">
                      {String(tag.value)} {tag.unit}
                    </td>
                    <td className="p-4">
                      <span className={cn('text-xs font-medium', qualityColors[tag.quality])}>
                        {tag.quality}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">{tag.device}</td>
                    <td className="p-4 text-xs text-muted-foreground">{tag.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
