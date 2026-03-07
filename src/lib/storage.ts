import { StockItem, StockOutput, TechnicalSheet } from '@/types/inventory';

const ITEMS_KEY = 'rondello_items';
const OUTPUTS_KEY = 'rondello_outputs';
const SHEETS_KEY = 'rondello_sheets';

function get<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function set<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Items
export function getItems(): StockItem[] { return get<StockItem>(ITEMS_KEY); }
export function saveItem(item: StockItem) {
  const items = getItems();
  const idx = items.findIndex(i => i.id === item.id);
  if (idx >= 0) items[idx] = item; else items.push(item);
  set(ITEMS_KEY, items);
}
export function deleteItem(id: string) {
  set(ITEMS_KEY, getItems().filter(i => i.id !== id));
}

// Outputs
export function getOutputs(): StockOutput[] { return get<StockOutput>(OUTPUTS_KEY); }
export function saveOutput(output: StockOutput) {
  const outputs = getOutputs();
  outputs.push(output);
  set(OUTPUTS_KEY, outputs);
  // Subtract from stock
  const items = getItems();
  const item = items.find(i => i.id === output.itemId);
  if (item) {
    item.currentStock = Math.max(0, item.currentStock - output.quantity);
    set(ITEMS_KEY, items);
  }
}
export function deleteOutput(id: string) {
  set(OUTPUTS_KEY, getOutputs().filter(o => o.id !== id));
}

// Technical Sheets
export function getSheets(): TechnicalSheet[] { return get<TechnicalSheet>(SHEETS_KEY); }
export function saveSheet(sheet: TechnicalSheet) {
  const sheets = getSheets();
  const idx = sheets.findIndex(s => s.id === sheet.id);
  if (idx >= 0) sheets[idx] = sheet; else sheets.push(sheet);
  set(SHEETS_KEY, sheets);
}
export function deleteSheet(id: string) {
  set(SHEETS_KEY, getSheets().filter(s => s.id !== id));
}
