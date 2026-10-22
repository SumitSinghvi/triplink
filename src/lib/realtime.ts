import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeMessage {
  id: string;
  match_id: string;
  sender_id: string;
  text: string;
  is_card?: boolean;
  created_at: string;
}

/**
 * Subscribes to realtime messages for a specific match or globally.
 * When another passenger sends a message, the onMessage callback fires instantly over WebSockets.
 */
export function subscribeToMatchMessages(
  matchId: string,
  onMessage: (message: RealtimeMessage) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        if (payload.new) {
          onMessage(payload.new as RealtimeMessage);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Supabase Realtime] Connected to match channel: ${matchId}`);
      }
    });

  // Return unsubscribe cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Sends a real-time message to Supabase.
 * Automatically broadcasts via Postgres WAL replication to all connected clients.
 */
export async function sendRealtimeMessage(params: {
  matchId: string;
  senderId: string;
  text: string;
  isCard?: boolean;
}): Promise<RealtimeMessage> {
  const newMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    match_id: params.matchId,
    sender_id: params.senderId,
    text: params.text,
    is_card: Boolean(params.isCard),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(newMsg)
    .select()
    .single();

  if (error) {
    console.error('[Supabase Realtime] Error sending message:', error);
    throw error;
  }

  return data as RealtimeMessage;
}
