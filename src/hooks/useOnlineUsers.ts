import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type OnlineUser = {
  user_id: string;
  display_name: string;
  role: string;
};

export function useOnlineUsers() {
  const { user, profile, role } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('app-presence', {
      config: { presence: { key: user.id } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, OnlineUser[]>;
      const users = Object.values(state).flat();
      setOnlineUsers(users);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: user.id,
          display_name: profile?.display_name || user.email || 'Usuário',
          role: role || 'employee',
        });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, profile?.display_name, role]);

  return onlineUsers;
}
