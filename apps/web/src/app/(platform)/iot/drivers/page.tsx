import type { Metadata } from 'next';
import { IotDriversView } from '@/features/iot/iot-drivers-view';
export const metadata: Metadata = { title: 'IoT Drivers | INDUSTRY360 MES' };
export default function DriversPage() { return <IotDriversView />; }
