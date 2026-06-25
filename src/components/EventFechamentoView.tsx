import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Payment {
  payment_date: string | null;
  value: number;
  notes: string | null;
  is_confirmed: boolean;
}
interface Additional {
  description: string | null;
  value: number;
}
interface Company {
  name: string | null;
  razao_social: string | null;
  cnpj: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  endereco: string | null;
  telefone: string | null;
  website: string | null;
}
interface EventData {
  event_name: string | null;
  event_date: string | null;
  guest_count: number | null;
  children_50_pct: number | null;
  price_per_person: number | null;
  professional_count: number | null;
  professional_meal_value: number | null;
  pricing_mode: string | null;
  contract_value: number | null;
  clients: { name: string | null } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const today = () => new Date().toLocaleDateString('pt-BR');

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  eventId: string;
  event: EventData;
  showWatermark?: boolean;
  showBilling?: boolean;
}

export default function EventFechamentoView({
  eventId,
  event,
  showWatermark = true,
  showBilling = true,
}: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [additionals, setAdditionals] = useState<Additional[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from('event_payments' as any)
        .select('payment_date, value, notes, is_confirmed')
        .eq('event_id', eventId)
        .order('payment_date'),
      supabase
        .from('event_additional_values' as any)
        .select('description, value')
        .eq('event_id', eventId),
      supabase
        .from('companies')
        .select('name, razao_social, cnpj, banco, agencia, conta, endereco, telefone, website')
        .limit(1),
    ]).then(([p, a, c]) => {
      setPayments((p.data ?? []) as Payment[]);
      setAdditionals((a.data ?? []) as Additional[]);
      setCompany(((c.data ?? [])[0] ?? null) as Company | null);
      setLoading(false);
    });
  }, [eventId]);

  if (loading) return null;

  const isPpx = event.pricing_mode !== 'fixed';
  const guests = event.guest_count ?? 0;
  const children = event.children_50_pct ?? 0;
  const ppx = event.price_per_person ?? 0;
  const profN = event.professional_count ?? 0;
  const profV = event.professional_meal_value ?? 0;
  const contV = event.contract_value ?? 0;
  const paying = guests - children;

  const base = isPpx
    ? paying * ppx + children * ppx * 0.5 + profN * profV
    : contV;
  const grand = base + additionals.reduce((s, a) => s + a.value, 0);

  const confirmedPayments = payments.filter((p) => p.is_confirmed);
  const totalPaid = confirmedPayments.reduce((s, p) => s + p.value, 0);
  const balance = grand - totalPaid;

  const clientName = event.event_name ?? event.clients?.name ?? 'Evento';

  // Billing address line
  const footerLine = [
    company?.endereco,
    company?.telefone,
    company?.website,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap');
        .fechamento-page { font-family: 'Libre Franklin', sans-serif; }
        @media print {
          body { background: #fff !important; }
          .fechamento-page { box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        className="fechamento-page"
        style={{
          width: 794,
          minHeight: 1123,
          margin: '32px auto',
          background: '#FFFFFF',
          boxShadow: '0 8px 40px rgba(14,42,69,.10)',
          padding: '40px 56px 40px',
          position: 'relative',
          color: '#2B2B2B',
          overflow: 'hidden',
        }}
      >
        {/* Watermark */}
        {showWatermark && (
          <img
            src="/emblem-rondello.png"
            alt=""
            style={{
              position: 'absolute',
              width: 520,
              height: 520,
              right: -150,
              bottom: -150,
              opacity: 0.045,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        )}

        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            position: 'relative',
          }}
        >
          <img
            src="/logo-rondello-fechamento.png"
            alt="Rondello Buffet"
            style={{ height: 58, width: 'auto' }}
          />
          <div
            style={{
              textAlign: 'right',
              fontSize: 9.5,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: '#9A968D',
              lineHeight: 1.7,
            }}
          >
            <div>Fechamento de evento</div>
            <div>Emitido em {today()}</div>
          </div>
        </div>

        {/* ── Title ── */}
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '.42em',
              textTransform: 'uppercase',
              color: '#C2A263',
              fontWeight: 600,
              paddingLeft: '.42em',
            }}
          >
            Fechamento
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600,
              fontSize: 42,
              lineHeight: 1.06,
              color: '#0E2A45',
              margin: '8px 0 0',
            }}
          >
            {clientName}
          </h1>
        </div>

        {/* ── Stats row ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            marginTop: 20,
            borderTop: '1px solid #E7E3DB',
            borderBottom: '1px solid #E7E3DB',
          }}
        >
          <StatCell label="Data do evento" value={fmtDate(event.event_date)} />
          <StatCell label="Convidados" value={String(guests || '—')} bordered />
          <StatCell
            label={isPpx ? 'Valor por convidado' : 'Valor do contrato'}
            value={fmtBRL(isPpx ? ppx : contV)}
          />
        </div>

        {/* ── Resumo ── */}
        <Section title="Resumo">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  color: '#A29D92',
                  fontSize: 9.5,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ fontWeight: 600, padding: '0 0 9px' }}>Item</th>
                <th style={{ fontWeight: 600, padding: '0 0 9px', textAlign: 'right' }}>Qtd.</th>
                <th style={{ fontWeight: 600, padding: '0 0 9px', textAlign: 'right' }}>
                  Valor unit.
                </th>
                <th style={{ fontWeight: 600, padding: '0 0 9px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}>
              {isPpx ? (
                <>
                  {paying > 0 && (
                    <ResumoRow
                      label="Convidados pagantes"
                      qty={paying}
                      unit={ppx}
                      total={paying * ppx}
                    />
                  )}
                  {children > 0 && (
                    <ResumoRow
                      label={
                        <>
                          Crianças{' '}
                          <span style={{ color: '#A29D92', fontSize: 11 }}>(50%)</span>
                        </>
                      }
                      qty={children}
                      unit={ppx * 0.5}
                      total={children * ppx * 0.5}
                    />
                  )}
                  {profN > 0 && (
                    <ResumoRow label="Staff" qty={profN} unit={profV} total={profN * profV} />
                  )}
                </>
              ) : (
                <ResumoRow label="Valor do contrato" total={contV} />
              )}
              {additionals.map((a, i) => (
                <ResumoRow
                  key={i}
                  label={a.description ?? 'Adicional'}
                  total={a.value}
                />
              ))}
            </tbody>
          </table>

          {/* Total bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
              background: '#0E2A45',
              color: '#FFFFFF',
              padding: '13px 18px',
              borderRadius: 3,
            }}
          >
            <span
              style={{
                fontSize: 11,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: '#C9D4E0',
              }}
            >
              Total do evento
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              } as React.CSSProperties}
            >
              {fmtBRL(grand)}
            </span>
          </div>
        </Section>

        {/* ── Pagamentos ── */}
        <Section title="Pagamentos efetuados">
          <div style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}>
            {confirmedPayments.length === 0 ? (
              <div style={{ color: '#A29D92', padding: '8px 0', fontSize: 12 }}>
                Nenhum pagamento registrado.
              </div>
            ) : (
              confirmedPayments.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '7px 0',
                    borderBottom: '1px solid #EFECE5',
                  }}
                >
                  <span style={{ color: '#6B6B6B' }}>{fmtDate(p.payment_date)}</span>
                  <span style={{ color: '#2B2B2B' }}>{fmtBRL(p.value)}</span>
                </div>
              ))
            )}
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid #E7E3DB',
                padding: '12px 16px',
                borderRadius: 3,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: '#A29D92',
                  fontWeight: 600,
                }}
              >
                Total pago
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#0E2A45',
                  fontVariantNumeric: 'tabular-nums',
                } as React.CSSProperties}
              >
                {fmtBRL(totalPaid)}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: balance <= 0 ? '#F0FDF4' : '#F7F1E5',
                border: `1px solid ${balance <= 0 ? '#BBF7D0' : '#E4D4B2'}`,
                padding: '12px 16px',
                borderRadius: 3,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: balance <= 0 ? '#15803D' : '#A07E2E',
                  fontWeight: 600,
                }}
              >
                {balance <= 0 ? 'Quitado' : 'A pagar'}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#0E2A45',
                  fontVariantNumeric: 'tabular-nums',
                } as React.CSSProperties}
              >
                {fmtBRL(Math.abs(balance))}
              </span>
            </div>
          </div>
        </Section>

        {/* ── Footer ── */}
        <div
          style={{
            marginTop: 34,
            paddingTop: 18,
            borderTop: '1px solid #E7E3DB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 24,
            position: 'relative',
          }}
        >
          {showBilling && (company?.razao_social || company?.cnpj || company?.banco) && (
            <div style={{ fontSize: 10.5, color: '#7C7C7C', lineHeight: 1.75 }}>
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: '#A29D92',
                  fontWeight: 600,
                  marginBottom: 5,
                }}
              >
                Dados para faturamento
              </div>
              {company?.razao_social && <div>Razão social · {company.razao_social}</div>}
              {company?.cnpj && <div>CNPJ / PIX · {company.cnpj}</div>}
              {(company?.banco || company?.agencia || company?.conta) && (
                <div>
                  {[
                    company?.banco && `Banco ${company.banco}`,
                    company?.agencia && `Ag. ${company.agencia}`,
                    company?.conta && `Conta ${company.conta}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
          )}

          <div style={{ textAlign: 'right', fontSize: 10.5, color: '#A29D92', lineHeight: 1.7, marginLeft: 'auto' }}>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20,
                color: '#C2A263',
                fontWeight: 600,
                letterSpacing: '.01em',
              }}
            >
              Rondello Buffet
            </div>
          </div>
        </div>

        {footerLine && (
          <div
            style={{
              marginTop: 16,
              textAlign: 'center',
              fontSize: 9.5,
              letterSpacing: '.06em',
              color: '#B0ABA0',
            }}
          >
            {footerLine}
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCell({
  label,
  value,
  bordered,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px 12px',
        ...(bordered
          ? { borderLeft: '1px solid #EDEAE2', borderRight: '1px solid #EDEAE2' }
          : {}),
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: '#A29D92',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, color: '#0E2A45', marginTop: 6, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: '#0E2A45',
            fontWeight: 600,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, background: '#EAE6DE' }} />
      </div>
      {children}
    </div>
  );
}

function ResumoRow({
  label,
  qty,
  unit,
  total,
}: {
  label: React.ReactNode;
  qty?: number;
  unit?: number;
  total: number;
}) {
  return (
    <tr style={{ borderTop: '1px solid #EFECE5' }}>
      <td style={{ padding: '11px 0', color: '#2B2B2B' }}>{label}</td>
      <td style={{ padding: '11px 0', textAlign: 'right', color: qty != null ? '#6B6B6B' : '#C9C5BC' }}>
        {qty != null ? qty : '—'}
      </td>
      <td style={{ padding: '11px 0', textAlign: 'right', color: unit != null ? '#6B6B6B' : '#C9C5BC' }}>
        {unit != null ? fmtBRL(unit) : '—'}
      </td>
      <td style={{ padding: '11px 0', textAlign: 'right', color: '#0E2A45', fontWeight: 600 }}>
        {fmtBRL(total)}
      </td>
    </tr>
  );
}
