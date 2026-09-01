import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WifiOff } from 'lucide-react';

const CHECK_INTERVAL_MS = 30_000; // a cada 30s
const FAIL_THRESHOLD = 2;         // avisa após 2 falhas seguidas

export function ConnectionHealthBanner() {
  const [offline, setOffline] = useState(false);
  const failures = useRef(0);

  useEffect(() => {
    const check = async () => {
      try {
        const { error } = await supabase
          .from('profiles' as any)
          .select('id', { count: 'exact', head: true })
          .limit(1);

        if (error) {
          failures.current += 1;
        } else {
          failures.current = 0;
          setOffline(false);
        }
      } catch {
        failures.current += 1;
      }

      if (failures.current >= FAIL_THRESHOLD) {
        setOffline(true);
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border border-red-300 text-white text-sm font-medium"
      style={{ background: 'hsl(0 72% 42%)', maxWidth: 480 }}
    >
      <WifiOff className="w-5 h-5 shrink-0 animate-pulse" />
      <span>
        <strong>Sem conexão com o banco de dados.</strong>{' '}
        Alterações feitas agora podem não ser salvas. Verifique sua internet ou aguarde.
      </span>
    </div>
  );
}
