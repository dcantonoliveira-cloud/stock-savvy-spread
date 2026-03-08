import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, FileText, DollarSign, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = [
  'hsl(38, 92%, 50%)',
  'hsl(152, 60%, 42%)',
  'hsl(220, 70%, 55%)',
  'hsl(0, 72%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(180, 60%, 40%)',
  'hsl(320, 60%, 50%)',
  'hsl(60, 70%, 45%)',
];

type StockItem = { id: string; name: string; category: string; unit: string; current_stock: number; min_stock: number; unit_cost: number };
type Output = { id: string; item_id: string; quantity: number; date: string; employee_name: string; event_name: string | null; created_at: string };
type Entry = { id: string; item_id: string; quantity: number; date: string; created_at: string };

export default function SupervisorDashboard() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [sheetsCount, setSheetsCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [itemsRes, outputsRes, entriesRes, usersRes, sheetsRes] = await Promise.all([
        supabase.from('stock_items').select('*'),
        supabase.from('stock_outputs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('stock_entries').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('user_roles').select('id').eq('role', 'employee'),
        supabase.from('technical_sheets').select('id'),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (outputsRes.data) setOutputs(outputsRes.data);
      if (entriesRes.data) setEntries(entriesRes.data);
      if (usersRes.data) setEmployeeCount(usersRes.data.length);
      if (sheetsRes.data) setSheetsCount(sheetsRes.data.length);
    };
    load();
  }, []);

  const totalValue = items.reduce((sum, i) => sum + i.current_stock * i.unit_cost, 0);
  const lowStock = items.filter(i => i.current_stock <= i.min_stock);
  const today = new Date().toISOString().split('T')[0];
  const todayOutputs = outputs.filter(o => o.date === today);
  const todayEntries = entries.filter(e => e.date === today);

  const categoryMap: Record<string, number> = {};
  items.forEach(i => {
    categoryMap[i.category] = (categoryMap[i.category] || 0) + i.current_stock * i.unit_cost;
  });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const movementData = last7.map(date => ({
    date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
    entradas: entries.filter(e => e.date === date).reduce((s, e) => s + e.quantity, 0),
    saidas: outputs.filter(o => o.date === date).reduce((s, o) => s + o.quantity, 0),
  }));

  const recentActivity = [
    ...outputs.slice(0, 5).map(o => ({
      type: 'output' as const,
      text: `${o.employee_name} retirou ${o.quantity} de ${items.find(i => i.id === o.item_id)?.name || '?'}`,
      event: o.event_name,
      time: o.created_at,
    })),
    ...entries.slice(0, 5).map(e => ({
      type: 'entry' as const,
      text: `Entrada de ${e.quantity} de ${items.find(i => i.id === e.item_id)?.name || '?'}`,
      event: null,
      time: e.created_at,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gold-text">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Visão geral do estoque</p>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={DollarSign} label="Valor em Estoque" value={`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} accent />
        <StatCard icon={Package} label="Itens Cadastrados" value={items.length} />
        <StatCard icon={AlertTriangle} label="Estoque Baixo" value={lowStock.length} warn={lowStock.length > 0} />
        <StatCard icon={Users} label="Funcionários" value={employeeCount} />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ArrowUpCircle} label="Entradas Hoje" value={todayEntries.length} />
        <StatCard icon={ArrowDownCircle} label="Saídas Hoje" value={todayOutputs.length} />
        <StatCard icon={FileText} label="Fichas Técnicas" value={sheetsCount} />
        <StatCard icon={TrendingUp} label="Total Movimentações" value={entries.length + outputs.length} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="glass-card border-0 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Movimentações (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={movementData} barGap={2}>
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-lg)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="entradas" fill="hsl(152, 60%, 42%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" fill="hsl(0, 72%, 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Valor por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} strokeWidth={2} stroke="hsl(var(--background))">
                    {categoryData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {lowStock.length > 0 && (
          <Card className="glass-card border-0 rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-warning/15 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                </div>
                Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lowStock.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-warning">{item.current_stock} {item.unit}</p>
                    <p className="text-[11px] text-muted-foreground">Mín: {item.min_stock}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="glass-card border-0 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentActivity.length > 0 ? recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${a.type === 'entry' ? 'bg-success' : 'bg-destructive'}`} />
                <div className="min-w-0">
                  <p className="text-sm text-foreground leading-snug">{a.text}</p>
                  {a.event && <p className="text-xs text-muted-foreground">{a.event}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(a.time).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade recente</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent, warn }: { icon: any; label: string; value: string | number; accent?: boolean; warn?: boolean }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          warn ? 'bg-warning/12 text-warning' : accent ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-extrabold tracking-tight ${warn ? 'text-warning' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
