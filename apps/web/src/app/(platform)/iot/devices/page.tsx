import type { Metadata } from 'next';
import { IotDevicesView } from '@/features/iot/iot-devices-view';

export const metadata: Metadata = { title: 'IIoT Devices | INDUSTRY360 MES' };

export default function IoTDevicesPage() {
  return <IotDevicesView />;
}
