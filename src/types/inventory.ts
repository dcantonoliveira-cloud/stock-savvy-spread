export interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  createdAt: string;
}

export interface StockOutput {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  employeeName: string;
  eventName?: string;
  notes?: string;
  date: string;
  createdAt: string;
}

export interface TechnicalSheet {
  id: string;
  name: string;
  servings: number;
  items: TechnicalSheetItem[];
  createdAt: string;
}

export interface TechnicalSheetItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
}

export type Category = 'Carnes' | 'Bebidas' | 'Frios' | 'Hortifruti' | 'Secos' | 'Descartáveis' | 'Limpeza' | 'Outros';

export const CATEGORIES: Category[] = ['Carnes', 'Bebidas', 'Frios', 'Hortifruti', 'Secos', 'Descartáveis', 'Limpeza', 'Outros'];

export const UNITS = ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct', 'lata', 'garrafa'];
