import type { Metadata } from 'next';
import { ProductionRecipesView } from '@/features/production/production-recipes-view';
export const metadata: Metadata = { title: 'Recipe Management | STAR-MES' };
export default function RecipesPage() { return <ProductionRecipesView />; }
