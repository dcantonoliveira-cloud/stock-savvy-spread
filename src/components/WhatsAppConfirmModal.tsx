import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, ExternalLink, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { sendWhatsApp, openWhatsAppLink, getZapiConfig } from '@/lib/whatsapp';

export type WhatsAppTrigger = {
  phone: string;          // número do cliente
  clientName: string;     // para exibição
  message: string;        // mensagem pré-preenchida (editável)
};

interface Props {
  trigger: WhatsAppTrigger;
  onClose: () => void;
}

export default function WhatsAppConfirmModal({ trigger, onClose }: Props) {
  const [message, setMessage] = useState(trigger.message);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);

    const config = await getZapiConfig();

    if (!config) {
      // Sem Z-API: abre wa.me diretamente
      openWhatsAppLink(trigger.phone, message);
      toast.success('WhatsApp aberto no navegador');
      onClose();
      return;
    }

    const { ok, error } = await sendWhatsApp(trigger.phone, message);
    setSending(false);

    if (ok) {
      toast.success(`Mensagem enviada para ${trigger.clientName}`);
      onClose();
    } else {
      toast.error(`Erro ao enviar: ${error ?? 'desconhecido'}`);
    }
  };

  const handleOpenLink = () => {
    openWhatsAppLink(trigger.phone, message);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#25D366' }}>
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Enviar mensagem</p>
              <p className="text-xs text-muted-foreground">{trigger.clientName} · {trigger.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message editor */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
              Mensagem (editável)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none leading-relaxed"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              Pular
            </button>
            <button onClick={handleOpenLink}
              title="Abrir no WhatsApp Web"
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir no WhatsApp
            </button>
            <button onClick={handleSend} disabled={sending || !message.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              style={{ background: '#25D366', color: 'white' }}>
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
