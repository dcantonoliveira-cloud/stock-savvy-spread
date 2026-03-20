// Fator de conversão para a unidade base (kg para peso, L para volume)
export const TO_BASE: Record<string, number> = {
  kg: 1,    g: 0.001,   mg: 0.000001,
  L: 1,     l: 1,       ml: 0.001,
  un: 1,    cx: 1,      pct: 1,      dz: 12,   bd: 1,
  fatia: 1, porção: 1,  unid: 1,
};

export function getUnitFamily(unit: string): 'weight' | 'volume' | 'other' {
  const u = unit?.toLowerCase();
  if (['kg', 'g', 'mg'].includes(u)) return 'weight';
  if (['l', 'ml', 'dl', 'cl'].includes(u)) return 'volume';
  return 'other';
}

/** Retorna as unidades compatíveis para conversão com a unidade base do insumo */
export function getCompatibleUnits(itemUnit: string): string[] {
  const f = getUnitFamily(itemUnit);
  if (f === 'weight') return ['kg', 'g'];
  if (f === 'volume') return ['L', 'ml'];
  return [itemUnit];
}

/**
 * Converte uma quantidade da unidade da receita para a unidade do insumo.
 * Ex: convertToItemUnit(100, 'g', 'kg') → 0.1
 */
export function convertToItemUnit(qty: number, recipeUnit: string, itemUnit: string): number {
  if (recipeUnit === itemUnit) return qty;
  const fromFactor = TO_BASE[recipeUnit] ?? 1;
  const toFactor = TO_BASE[itemUnit] ?? 1;
  return qty * fromFactor / toFactor;
}

/**
 * Calcula o custo unitário para a unidade da receita, dado o custo na unidade do insumo.
 * Ex: calcRecipeUnitCost(10, 'kg', 'g') → 0.01  (R$0,01 por grama)
 */
export function calcRecipeUnitCost(itemCost: number, itemUnit: string, recipeUnit: string): number {
  if (recipeUnit === itemUnit) return itemCost;
  const itemFactor = TO_BASE[itemUnit] ?? 1;
  const recipeFactor = TO_BASE[recipeUnit] ?? 1;
  return itemCost * recipeFactor / itemFactor;
}
