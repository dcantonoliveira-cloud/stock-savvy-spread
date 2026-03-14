import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SupervisorSidebar from './SupervisorSidebar';
import { supabase } from '@/integrations/supabase/client';
import { Bell } from 'lucide-react';

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false as any);
      setUnread(count || 0);
    };
    load();

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <SupervisorSidebar />
      <div className="flex-1 ml-[260px] flex flex-col">
        {/* Top bar with bell */}
        <div className="flex justify-end items-center px-8 pt-6 pb-0">
          <Link
            to="/notifications"
            className="relative p-2 rounded-xl hover:bg-accent transition-colors"
            title="Notificações"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        </div>
        <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
