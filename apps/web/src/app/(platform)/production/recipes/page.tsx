import type { Metadata } from 'next';
import { ProductionRecipesView } from '@/features/production/production-recipes-view';
export const metadata: Metadata = { title: 'Recipe Management | INDUSTRY360 MES' };
export default function RecipesPage() { return <ProductionRecipesView />; }
