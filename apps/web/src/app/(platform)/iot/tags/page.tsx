import type { Metadata } from 'next';
import { IotTagsView } from '@/features/iot/iot-tags-view';
export const metadata: Metadata = { title: 'Tag Browser | INDUSTRY360 MES' };
export default function TagsPage() { return <IotTagsView />; }
