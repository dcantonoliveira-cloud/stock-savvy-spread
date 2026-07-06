import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Camera, Lock } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_base64: string | null;
  phone: string | null;
}

const inputCls = 'w-full h-10 px-3 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5';

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export default function MeuPerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('*').eq('user_id', user.id).single().then(({ data }) => {
        if (data) setProfile(data as any);
      });
    });
  }, []);

  const saveProfile = (field: string, value: string | null) => {
    if (!profile) return;
    setProfile(prev => prev ? { ...prev, [field]: value } : prev);
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(async () => {
      const { error } = await supabase.from('profiles').update({ [field]: value } as any).eq('id', profile.id);
      if (error) toast.error('Erro ao salvar'); else toast.success('Salvo');
    }, 1000);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!profile) return;
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await supabase.from('profiles').update({ avatar_base64: base64 } as any).eq('id', profile.id);
      setProfile(prev => prev ? { ...prev, avatar_base64: base64 } : prev);
      toast.success('Foto atualizada');
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarRemove = async () => {
    if (!profile) return;
    await supabase.from('profiles').update({ avatar_base64: null } as any).eq('id', profile.id);
    setProfile(prev => prev ? { ...prev, avatar_base64: null } : prev);
    toast.success('Foto removida');
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error('Erro ao alterar senha');
    else { toast.success('Senha alterada'); setNewPassword(''); }
    setPwdSaving(false);
  };

  if (!profile) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const initials = profile.display_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';

  return (
    <div className="max-w-xl space-y-4">

      {/* Foto & identidade */}
      <div className="bg-white border border-border rounded-2xl p-6 space-y-6">
        <Section title="Foto & identidade" />

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative group cursor-pointer" onClick={() => avatarRef.current?.click()}>
            {profile.avatar_base64 ? (
              <img src={profile.avatar_base64} alt="" className="w-20 h-20 rounded-2xl object-cover border border-border" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary border border-border select-none">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarUploading
                ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                : <Camera className="w-5 h-5 text-white" />}
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
          </div>
          <div>
            <p className="font-semibold text-foreground">{profile.display_name}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <button onClick={() => avatarRef.current?.click()} className="text-xs text-primary hover:underline">
                Trocar foto
              </button>
              {profile.avatar_base64 && (
                <button onClick={handleAvatarRemove} className="text-xs text-muted-foreground hover:text-destructive">
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Nome de exibição">
            <input className={inputCls} value={profile.display_name}
              onChange={e => saveProfile('display_name', e.target.value)} />
          </Field>
          <Field label="E-mail">
            <input className={`${inputCls} opacity-50 cursor-not-allowed`} value={profile.email} readOnly />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input className={inputCls} value={profile.phone ?? ''}
              onChange={e => saveProfile('phone', e.target.value)}
              placeholder="(15) 99999-0000" />
          </Field>
        </div>
      </div>

      {/* Segurança */}
      <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
        <Section title="Segurança" />
        <Field label="Nova senha">
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={`${inputCls} pr-10`}
            />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <button onClick={handlePasswordChange} disabled={pwdSaving || !newPassword}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors disabled:opacity-40">
          <Lock className="w-3.5 h-3.5" />
          {pwdSaving ? 'Salvando…' : 'Alterar senha'}
        </button>
      </div>
    </div>
  );
}
