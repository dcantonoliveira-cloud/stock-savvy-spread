import { useState } from 'react';
import { X, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// ── Definição dos campos disponíveis ──────────────────────────────────────────

const FIELD_GROUPS = [
  {
    group: 'Evento',
    fields: [
      { key: 'event_name',          label: 'Nome do evento' },
      { key: 'status',              label: 'Status' },
      { key: 'event_date',          label: 'Data do evento' },
      { key: 'location_text',       label: 'Local' },
      { key: 'date_reserved',       label: 'Data reservada?' },
      { key: 'contract_signed',     label: 'Contrato assinado?' },
      { key: 'contract_signed_date',label: 'Data assinatura do contrato' },
      { key: 'created_at',          label: 'Data de cadastro' },
    ],
  },
  {
    group: 'Financeiro',
    fields: [
      { key: 'guest_count',         label: 'Nº de convidados' },
      { key: 'children_50_pct',     label: 'Crianças (50%)' },
      { key: 'price_per_person',    label: 'Valor por pessoa (R$)' },
      { key: 'total_value',         label: 'Valor total estimado (R$)' },
      { key: 'additional_hours',    label: 'Horas extras' },
      { key: 'extra_hour_price',    label: 'Valor hora extra (R$)' },
      { key: 'total_extra',         label: 'Total horas extras (R$)' },
      { key: 'total_festa',         label: 'Valor total da festa (R$)' },
    ],
  },
  {
    group: 'Cliente',
    fields: [
      { key: 'client_name',         label: 'Nome do cliente' },
      { key: 'client_phone',        label: 'Telefone do cliente' },
      { key: 'client_email',        label: 'E-mail do cliente' },
      { key: 'contratante_cpf',     label: 'CPF' },
      { key: 'contratante_address', label: 'Endereço do cliente' },
      { key: 'source',              label: 'Origem do lead' },
    ],
  },
  {
    group: 'Detalhes do evento',
    fields: [
      { key: 'duration_hours',        label: 'Tempo de festa (h)' },
      { key: 'start_time',            label: 'Horário início' },
      { key: 'end_time',              label: 'Horário término' },
      { key: 'product_name',          label: 'Produto' },
      { key: 'professional_count',    label: 'Staff (nº profissionais)' },
      { key: 'rechaud',               label: 'Rechaud' },
      { key: 'tablecloth',            label: 'Toalha' },
      { key: 'table_count',           label: 'Nº de mesas' },
      { key: 'guests_per_table',      label: 'Pessoas por mesa' },
    ],
  },
  {
    group: 'Cardápio',
    fields: [
      { key: 'menu_mode',  label: 'Modo do cardápio' },
      { key: 'menu_text',  label: 'Cardápio (texto)' },
    ],
  },
  {
    group: 'Perdas',
    fields: [
      { key: 'lost_reason', label: 'Motivo de não fechou' },
    ],
  },
  {
    group: 'Informações internas',
    fields: [
      { key: 'organizer',   label: 'Responsável / Assessoria' },
      { key: 'notes',       label: 'Observações' },
    ],
  },
];

const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key));
const DEFAULT_FIELDS = new Set([
  'event_name', 'status', 'event_date', 'location_text',
  'client_name', 'guest_count', 'price_per_person',
]);

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', negotiating: 'Negociando', tasting_scheduled: 'Degustação agendada',
  confirmed: 'Confirmado', completed: 'Concluído', lost: 'Não fechou', cancelled: 'Cancelado',
};

function fmtDate(d: string | null | undefined) {
  if (!d) return '';
  return d.slice(0, 10).split('-').reverse().join('/');
}

function fmtBool(v: boolean | null | undefined) {
  if (v == null) return '';
  return v ? 'Sim' : 'Não';
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function ExportEventosModal({ onClose, currentFilter }: {
  onClose: () => void;
  currentFilter: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const [exporting, setExporting] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(FIELD_GROUPS.map(g => g.group)));
  const [filterExport, setFilterExport] = useState<'all' | 'current'>(
    currentFilter !== 'all' ? 'current' : 'all'
  );

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: string, fields: { key: string }[]) => {
    const allOn = fields.every(f => selected.has(f.key));
    setSelected(prev => {
      const next = new Set(prev);
      fields.forEach(f => allOn ? next.delete(f.key) : next.add(f.key));
      return next;
    });
  };

  const toggleGroupOpen = (group: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ALL_FIELD_KEYS));
  const clearAll  = () => setSelected(new Set());

  const doExport = async () => {
    if (selected.size === 0) { toast.error('Selecione pelo menos um campo'); return; }
    setExporting(true);
    try {
      let q = supabase
        .from('events')
        .select('*, clients(name, phone, email, cpf, address, source)')
        .is('deleted_at', null)
        .order('event_date', { ascending: false });

      if (filterExport === 'current' && currentFilter !== 'all') {
        if (currentFilter === 'pipeline') {
          q = q.in('status', ['lead', 'negotiating', 'tasting_scheduled']);
        } else if (currentFilter === 'confirmed') {
          q = q.in('status', ['confirmed', 'completed']);
        } else if (currentFilter === 'lost') {
          q = q.in('status', ['lost', 'cancelled']);
        }
      }

      const { data, error } = await q;
      if (error) throw error;

      // Ordena os campos conforme definição
      const orderedKeys = ALL_FIELD_KEYS.filter(k => selected.has(k));
      const labelMap = Object.fromEntries(
        FIELD_GROUPS.flatMap(g => g.fields.map(f => [f.key, f.label]))
      );

      const rows = (data ?? []).map((ev: any) => {
        const row: Record<string, string | number> = {};
        for (const key of orderedKeys) {
          switch (key) {
            case 'status':              row[labelMap[key]] = STATUS_LABELS[ev.status] ?? ev.status ?? ''; break;
            case 'event_date':          row[labelMap[key]] = fmtDate(ev.event_date); break;
            case 'created_at':          row[labelMap[key]] = fmtDate(ev.created_at); break;
            case 'contract_signed_date':row[labelMap[key]] = fmtDate(ev.contract_signed_date); break;
            case 'date_reserved':       row[labelMap[key]] = fmtBool(ev.date_reserved); break;
            case 'contract_signed':     row[labelMap[key]] = fmtBool(ev.contract_signed); break;
            case 'client_name':         row[labelMap[key]] = ev.clients?.name ?? ev.contratante_name ?? ''; break;
            case 'client_phone':        row[labelMap[key]] = ev.clients?.phone ?? ev.contratante_phone ?? ''; break;
            case 'client_email':        row[labelMap[key]] = ev.clients?.email ?? ev.contratante_email ?? ''; break;
            case 'contratante_cpf':     row[labelMap[key]] = ev.clients?.cpf ?? ev.contratante_cpf ?? ''; break;
            case 'contratante_address': row[labelMap[key]] = ev.clients?.address ?? ev.contratante_address ?? ''; break;
            case 'source':              row[labelMap[key]] = ev.clients?.source ?? ''; break;
            case 'total_value': {
              const g = ev.guest_count ?? 0;
              const p = ev.price_per_person ?? 0;
              row[labelMap[key]] = g && p ? g * p : '';
              break;
            }
            case 'total_extra': {
              const h = ev.additional_hours ?? 0;
              const hp = ev.extra_hour_price ?? 0;
              row[labelMap[key]] = h && hp ? h * hp : '';
              break;
            }
            case 'total_festa': {
              const g2 = ev.guest_count ?? 0;
              const p2 = ev.price_per_person ?? 0;
              const base = g2 && p2 ? g2 * p2 : 0;
              const h2 = ev.additional_hours ?? 0;
              const hp2 = ev.extra_hour_price ?? 0;
              const extra = h2 && hp2 ? h2 * hp2 : 0;
              row[labelMap[key]] = base + extra || '';
              break;
            }
            default: row[labelMap[key]] = ev[key] ?? '';
          }
        }
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Eventos');

      // Largura automática por coluna
      const colWidths = orderedKeys.map(k => ({
        wch: Math.max(labelMap[k].length, 14),
      }));
      ws['!cols'] = colWidths;

      const fileName = `eventos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`${rows.length} evento(s) exportado(s)`);
      onClose();
    } catch (e: any) {
      toast.error('Erro ao exportar: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <p className="font-semibold text-foreground text-sm">Exportar para Excel</p>
            <p className="text-xs text-muted-foreground mt-0.5">Escolha os campos que quer na planilha</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filtro de quais eventos exportar */}
        <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium">Exportar:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={filterExport === 'all'} onChange={() => setFilterExport('all')}
              className="accent-primary" />
            <span className="text-xs text-foreground">Todos os eventos</span>
          </label>
          {currentFilter !== 'all' && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={filterExport === 'current'} onChange={() => setFilterExport('current')}
                className="accent-primary" />
              <span className="text-xs text-foreground">Somente aba atual</span>
            </label>
          )}
        </div>

        {/* Selecionar tudo / limpar */}
        <div className="px-5 py-2 border-b border-border shrink-0 flex items-center gap-3">
          <button onClick={selectAll} className="text-xs text-primary hover:underline">Selecionar todos</button>
          <span className="text-muted-foreground/40">|</span>
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:underline">Limpar</button>
          <span className="ml-auto text-xs text-muted-foreground">{selected.size} campo(s) selecionado(s)</span>
        </div>

        {/* Grupos de campos */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">
          {FIELD_GROUPS.map(({ group, fields }) => {
            const allOn = fields.every(f => selected.has(f.key));
            const someOn = fields.some(f => selected.has(f.key));
            const open = openGroups.has(group);
            return (
              <div key={group} className="border border-border rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-2 px-3 py-2.5 bg-muted/40 cursor-pointer select-none"
                  onClick={() => toggleGroupOpen(group)}
                >
                  <input
                    type="checkbox"
                    checked={allOn}
                    ref={el => { if (el) el.indeterminate = !allOn && someOn; }}
                    onChange={() => toggleGroup(group, fields)}
                    onClick={e => e.stopPropagation()}
                    className="accent-primary"
                  />
                  <span className="text-xs font-semibold text-foreground flex-1">{group}</span>
                  {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                {open && (
                  <div className="divide-y divide-border/60">
                    {fields.map(f => (
                      <label key={f.key} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.has(f.key)}
                          onChange={() => toggle(f.key)}
                          className="accent-primary"
                        />
                        <span className="text-xs text-foreground">{f.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={doExport}
            disabled={exporting || selected.size === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exportando…' : 'Baixar Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
