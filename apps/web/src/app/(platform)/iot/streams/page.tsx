import type { Metadata } from 'next';
import { IotStreamsView } from '@/features/iot/iot-streams-view';
export const metadata: Metadata = { title: 'Data Streams | STAR-MES' };
export default function StreamsPage() { return <IotStreamsView />; }
