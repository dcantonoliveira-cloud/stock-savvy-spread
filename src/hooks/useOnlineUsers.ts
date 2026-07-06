import { useEffect, useRef, useState } from 'react';
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    // Create channel once per user session
    if (!channelRef.current) {
      channelRef.current = supabase.channel('app-presence', {
        config: { presence: { key: user.id } },
      });

      channelRef.current.on('presence', { event: 'sync' }, () => {
        const state = channelRef.current!.presenceState() as Record<string, OnlineUser[]>;
        const seen = new Set<string>();
        const users: OnlineUser[] = [];
        for (const entries of Object.values(state)) {
          for (const u of entries) {
            if (!seen.has(u.user_id)) {
              seen.add(u.user_id);
              users.push(u);
            }
          }
        }
        setOnlineUsers(users);
      });

      channelRef.current.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channelRef.current!.track({
            user_id: user.id,
            display_name: profile?.display_name || user.email || 'Usuário',
            role: role || 'employee',
          });
        }
      });
    } else {
      // Channel already exists — just update the tracked state
      channelRef.current.track({
        user_id: user.id,
        display_name: profile?.display_name || user.email || 'Usuário',
        role: role || 'employee',
      });
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [user?.id]); // only re-create channel if user changes

  // Update tracked payload when profile/role change without re-subscribing
  useEffect(() => {
    if (!channelRef.current || !user) return;
    channelRef.current.track({
      user_id: user.id,
      display_name: profile?.display_name || user.email || 'Usuário',
      role: role || 'employee',
    });
  }, [profile?.display_name, role]);

  return onlineUsers;
}
