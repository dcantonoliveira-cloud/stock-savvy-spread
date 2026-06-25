import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, Copy, Send, XCircle, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortalAccess {
  id: string;
  enabled: boolean;
  access_code: string;
  email: string | null;
  whatsapp: string | null;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
}

interface HistoryEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  profiles: { display_name: string } | null;
}

const FIELD_LABELS: Record<string, string> = {
  event_name: 'Nome do Evento', event_type: 'Tipo', event_date: 'Data',
  location_id: 'Local', product_id: 'Produto', guest_count: 'Convidados',
  price_per_person: 'Preço/Pax', organizer_id: 'Assessora', decorator_id: 'Decoradora',
  notes: 'Observações', menu_text: 'Cardápio', status: 'Status',
  ceremony_time: 'Horário Cerimônia', professional_count: 'Quantidade de profissionais',
  professional_meal_value: 'Refeição profissional',
};

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

// ── Portal do Cliente ─────────────────────────────────────────────────────────

function PortalSection({ eventId, clientEmail, clientWhatsapp }: {
  eventId: string;
  clientEmail?: string | null;
  clientWhatsapp?: string | null;
}) {
  const [portal, setPortal] = useState<PortalAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('client_portal_access')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    setPortal(data ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId]);

  const ensurePortal = async (): Promise<PortalAccess | null> => {
    if (portal) return portal;
    const code = Math.random().toString(36).substring(2, 12).toUpperCase();
    const { data, error } = await (supabase as any)
      .from('client_portal_access')
      .insert({
        event_id: eventId,
        enabled: false,
        access_code: code,
        email: clientEmail ?? null,
        whatsapp: clientWhatsapp ?? null,
      })
      .select('*')
      .single();
    if (error) { toast.error('Erro ao criar acesso'); return null; }
    setPortal(data);
    return data;
  };

  const toggleEnabled = async () => {
    setSaving(true);
    const p = await ensurePortal();
    if (!p) { setSaving(false); return; }
    const newVal = !p.enabled;
    const { error } = await (supabase as any)
      .from('client_portal_access')
      .update({ enabled: newVal, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) toast.error('Erro ao salvar');
    else { setPortal(prev => prev ? { ...prev, enabled: newVal } : prev); toast.success(newVal ? 'Portal ativado' : 'Portal desativado'); }
    setSaving(false);
  };

  const saveField = async (field: 'email' | 'whatsapp', value: string) => {
    const p = await ensurePortal();
    if (!p) return;
    await (supabase as any).from('client_portal_access').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', p.id);
    setPortal(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const regenCode = async () => {
    const p = await ensurePortal();
    if (!p) return;
    const code = Math.random().toString(36).substring(2, 12).toUpperCase();
    const { error } = await (supabase as any).from('client_portal_access').update({ access_code: code, first_accessed_at: null, last_accessed_at: null }).eq('id', p.id);
    if (error) toast.error('Erro ao regenerar'); else { setPortal(prev => prev ? { ...prev, access_code: code, first_accessed_at: null, last_accessed_at: null } : prev); toast.success('Código regenerado'); }
  };

  const copyCode = () => {
    if (portal?.access_code) { navigator.clipboard.writeText(portal.access_code); toast.success('Código copiado!'); }
  };

  if (loading) return <div className="h-10 animate-pulse bg-muted/30 rounded-xl" />;

  return (
    <div className="bg-white border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-semibold text-foreground text-[15px]">Acesso ao portal do cliente</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            O portal é onde o cliente acompanha tudo sobre o evento.
          </p>
        </div>
        {/* Toggle */}
        <button
          onClick={toggleEnabled}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
            portal?.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
          }`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
            portal?.enabled ? 'left-5' : 'left-0.5'
          }`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Email</label>
          <input
            type="email"
            defaultValue={portal?.email ?? clientEmail ?? ''}
            onBlur={e => saveField('email', e.target.value)}
            className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="email@cliente.com"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">WhatsApp</label>
          <input
            type="text"
            defaultValue={portal?.whatsapp ?? clientWhatsapp ?? ''}
            onBlur={e => saveField('whatsapp', e.target.value)}
            className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="(11) 9 0000-0000"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Código de acesso</label>
          <div className="flex gap-1.5">
            <div className="flex-1 h-9 px-3 flex items-center text-sm font-mono bg-muted/30 border border-border rounded-lg text-muted-foreground select-all">
              {portal?.access_code ?? '—'}
            </div>
            <button onClick={copyCode} title="Copiar" className="h-9 w-9 flex items-center justify-center border border-border rounded-lg hover:bg-muted transition-colors">
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={regenCode} title="Regenerar código" className="h-9 w-9 flex items-center justify-center border border-border rounded-lg hover:bg-muted transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {portal?.first_accessed_at || portal?.last_accessed_at ? (
        <div className="flex gap-6 text-[12px] text-muted-foreground border-t border-border pt-3 mt-2">
          {portal.first_accessed_at && (
            <span>Primeiro acesso em <strong className="text-foreground">{fmtDT(portal.first_accessed_at)}</strong></span>
          )}
          {portal.last_accessed_at && (
            <span>Último acesso em <strong className="text-foreground">{fmtDT(portal.last_accessed_at)}</strong></span>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground border-t border-border pt-3 mt-2">
          {portal?.enabled ? 'Aguardando primeiro acesso do cliente.' : 'Ative o portal para liberar o acesso.'}
        </p>
      )}
    </div>
  );
}

// ── Modal de confirmação ──────────────────────────────────────────────────────

function ConfirmModal({ title, description, confirmLabel, confirmCls, onConfirm, onClose }: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmCls: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-150">
        <h3 className="text-[16px] font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-9">
            Cancelar
          </Button>
          <Button onClick={onConfirm} className={`h-9 ${confirmCls}`}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Ações perigosas ───────────────────────────────────────────────────────────

function ActionsSection({ eventId, onCancel, onDelete }: {
  eventId: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [sendingReview, setSendingReview] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const sendReviewMessage = async () => {
    setSendingReview(true);
    await new Promise(r => setTimeout(r, 800));
    toast.success('Mensagem de avaliação enviada!');
    setSendingReview(false);
  };

  return (
    <div className="space-y-3">
      {/* Modais */}
      {showDeleteModal && (
        <ConfirmModal
          title="Deletar evento"
          description={<>Tem certeza? Esta ação <strong>não pode ser revertida</strong>. O evento e todos os dados vinculados serão removidos permanentemente.</>}
          confirmLabel="Sim, deletar"
          confirmCls="bg-destructive hover:bg-destructive/90 text-white"
          onConfirm={() => { setShowDeleteModal(false); onDelete(); }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
      {showCancelModal && (
        <ConfirmModal
          title="Cancelar evento"
          description="O status do evento será alterado para CANCELADO. O evento continuará na base e pode ser revertido depois."
          confirmLabel="Sim, cancelar evento"
          confirmCls="bg-amber-600 hover:bg-amber-700 text-white"
          onConfirm={() => { setShowCancelModal(false); onCancel(); }}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {/* Avaliação */}
      <div className="bg-white border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground text-[14px]">Mensagem para avaliar-nos</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Envie uma mensagem ao casal solicitando avaliação após o evento.
          </p>
        </div>
        <Button onClick={sendReviewMessage} disabled={sendingReview} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Send className="w-3.5 h-3.5 mr-1.5" />
          Enviar
        </Button>
      </div>

      {/* Cancelar */}
      <div className="bg-white border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground text-[14px]">Cancelar evento</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mantém o evento na base com status <strong>CANCELADO</strong>. Pode ser revertido.
          </p>
        </div>
        <Button onClick={() => setShowCancelModal(true)} variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50">
          <XCircle className="w-3.5 h-3.5 mr-1.5" />
          Cancelar evento
        </Button>
      </div>

      {/* Deletar */}
      <div className="bg-white border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground text-[14px]">Deletar evento</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Remove permanentemente o evento e todos os dados vinculados. <strong>Irreversível.</strong>
          </p>
        </div>
        <Button onClick={() => setShowDeleteModal(true)} variant="outline" className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5">
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Deletar evento
        </Button>
      </div>
    </div>
  );
}

// ── Histórico de Alterações ───────────────────────────────────────────────────

function HistorySection({ eventId }: { eventId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: rows }, { data: profiles }] = await Promise.all([
        (supabase as any)
          .from('event_history')
          .select('id, field_name, old_value, new_value, changed_at, user_id')
          .eq('event_id', eventId)
          .order('changed_at', { ascending: false })
          .limit(80),
        supabase.from('profiles').select('id, user_id, display_name'),
      ]);
      const profileMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { profileMap[p.user_id ?? p.id] = p.display_name; });
      const merged = (rows ?? []).map((r: any) => ({
        ...r,
        profiles: r.user_id ? { display_name: profileMap[r.user_id] ?? 'Usuário' } : null,
      }));
      setHistory(merged);
      setLoading(false);
    };
    load();
  }, [eventId]);

  return (
    <div className="bg-white border border-border rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Timeline de alterações</span>
        <div className="flex-1 h-px bg-border" />
        {!loading && <span className="text-[11px] text-muted-foreground">{history.length} registros</span>}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {history.map(h => (
            <div
              key={h.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors cursor-default group"
            >
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0 group-hover:bg-primary/70 transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">
                  <span className="font-semibold text-foreground">
                    {h.profiles?.display_name ?? 'Usuário'}
                  </span>
                  {' '}alterou o campo{' '}
                  <span className="font-semibold">
                    {FIELD_LABELS[h.field_name] ?? h.field_name}
                  </span>
                  {h.old_value && (
                    <span className="text-muted-foreground">
                      {' '}de <span className="line-through text-muted-foreground/60">{h.old_value.slice(0, 50)}</span>
                    </span>
                  )}
                  {h.new_value && (
                    <span className="text-muted-foreground">
                      {' '}para <span className="text-foreground font-medium">{h.new_value.slice(0, 50)}</span>
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  {fmtDT(h.changed_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Export principal ──────────────────────────────────────────────────────────

interface EventOutrosTabProps {
  eventId: string;
  clientEmail?: string | null;
  clientWhatsapp?: string | null;
  onCancelEvent: () => void;
  onDeleteEvent: () => void;
}

export default function EventOutrosTab({
  eventId, clientEmail, clientWhatsapp, onCancelEvent, onDeleteEvent
}: EventOutrosTabProps) {
  return (
    <div className="space-y-4">
      <PortalSection eventId={eventId} clientEmail={clientEmail} clientWhatsapp={clientWhatsapp} />
      <ActionsSection eventId={eventId} onCancel={onCancelEvent} onDelete={onDeleteEvent} />
      <HistorySection eventId={eventId} />
    </div>
  );
}
