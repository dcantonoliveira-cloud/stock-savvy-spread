import ShoppingListView from './ShoppingListView';

export default function ShoppingListStep({ menuId, onBack }: { menuId: string; onBack: () => void }) {
  return <ShoppingListView menuIds={[menuId]} title="Lista de Compras" onBack={onBack} />;
}
