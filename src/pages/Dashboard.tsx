import { useEffect, useState } from 'react';
import { getItems, getOutputs, getSheets } from '@/lib/storage';
import { StockItem, StockOutput } from '@/types/inventory';
import { Package, ArrowDownCircle, AlertTriangle, FileText } from 'lucide-react';

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${accent ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-display font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [outputs, setOutputs] = useState<StockOutput[]>([]);
  const [sheetsCount, setSheetsCount] = useState(0);

  useEffect(() => {
    setItems(getItems());
    setOutputs(getOutputs());
    setSheetsCount(getSheets().length);
  }, []);

  const lowStock = items.filter(i => i.currentStock <= i.minStock);
  const todayOutputs = outputs.filter(o => o.date === new Date().toISOString().split('T')[0]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold gold-text">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do estoque</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Package} label="Itens Cadastrados" value={items.length} accent />
        <StatCard icon={ArrowDownCircle} label="Saídas Hoje" value={todayOutputs.length} />
        <StatCard icon={AlertTriangle} label="Estoque Baixo" value={lowStock.length} />
        <StatCard icon={FileText} label="Fichas Técnicas" value={sheetsCount} />
      </div>

      {lowStock.length > 0 && (
        <div className="glass-card rounded-xl p-6 animate-fade-in">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Itens com Estoque Baixo
          </h2>
          <div className="space-y-3">
            {lowStock.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-warning">{item.currentStock} {item.unit}</p>
                  <p className="text-xs text-muted-foreground">Mín: {item.minStock} {item.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center animate-fade-in">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-display font-semibold text-foreground mb-2">Nenhum item cadastrado</h2>
          <p className="text-muted-foreground text-sm">Comece cadastrando seus itens de estoque na seção "Estoque".</p>
        </div>
      )}
    </div>
  );
}
