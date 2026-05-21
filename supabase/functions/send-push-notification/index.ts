// Supabase Edge Function: send-push-notification
// Tetikleyenler:
//   1) notifications INSERT → pg_net DB trigger (migration)
//   2) Client → supabase.functions.invoke (createNotification / triggerPushNotification)
//   3) Supabase Dashboard Database Webhook (opsiyonel)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationRow {
  id: string;
  user_id: string;
  sender_id?: string;
  type: string;
  message?: string;
  match_id?: string;
  position?: string;
  is_read: boolean;
  created_at?: string;
}

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: NotificationRow;
  schema: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const notification = payload.record;
  if (!notification?.id || !notification?.user_id) {
    return new Response('Missing notification id or user_id', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Kaydın gerçekten DB'de olduğunu doğrula (sahte istekleri engelle)
  const { data: stored, error: fetchError } = await supabase
    .from('notifications')
    .select('id, user_id, sender_id, type, message, match_id, position, is_read, created_at')
    .eq('id', notification.id)
    .single();

  if (fetchError || !stored) {
    return new Response('Notification not found', { status: 404 });
  }

  if (
    stored.user_id !== notification.user_id ||
    stored.type !== notification.type
  ) {
    return new Response('Notification mismatch', { status: 400 });
  }

  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', stored.user_id);

  if (tokenError) {
    console.error('[Push] Token fetch error:', tokenError.message);
    return new Response(JSON.stringify({ error: tokenError.message }), { status: 500 });
  }

  if (!tokens?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_tokens' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  let senderName = 'SahayaBak';
  if (stored.sender_id) {
    const { data: sender } = await supabase
      .from('users')
      .select('name, surname')
      .eq('id', stored.sender_id)
      .single();
    if (sender?.name) {
      senderName = [sender.name, sender.surname].filter(Boolean).join(' ');
    }
  }

  const { title, body } = buildNotificationContent(
    stored.type,
    senderName,
    stored.message,
    stored.position,
  );

  const messages = tokens.map(({ token }) => ({
    to: token,
    title,
    body,
    sound: 'default',
    priority: 'high',
    data: {
      type: stored.type,
      notificationId: stored.id,
      matchId: stored.match_id ?? null,
      senderId: stored.sender_id ?? null,
    },
    channelId: 'default',
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const result = await response.json();
  console.log('[Push] Expo response:', JSON.stringify(result));

  return new Response(JSON.stringify({ ok: true, sent: messages.length, result }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});

function buildNotificationContent(
  type: string,
  senderName: string,
  message?: string,
  position?: string,
): { title: string; body: string } {
  switch (type) {
    case 'direct_message':
      return {
        title: senderName,
        body: message
          ? message.length > 80
            ? message.slice(0, 77) + '...'
            : message
          : 'Yeni mesaj',
      };
    case 'follow_request':
      if (message?.includes('kabul etti') || message?.toLowerCase().includes('accepted')) {
        return {
          title: 'SahayaBak',
          body: `${senderName} takip isteğini kabul etti.`,
        };
      }
      if (message?.includes('redded') || message?.toLowerCase().includes('reject')) {
        return {
          title: 'SahayaBak',
          body: `${senderName} takip isteğini reddetti.`,
        };
      }
      return {
        title: 'SahayaBak',
        body: `${senderName} seni takip etmek istiyor.`,
      };
    case 'join_request':
      if (message?.includes('kabul edildiniz') || message?.includes('kabul edildi')) {
        return {
          title: 'SahayaBak',
          body: message.length > 100 ? message.slice(0, 97) + '...' : message,
        };
      }
      if (message?.includes('kabul edilmediniz') || message?.includes('redded')) {
        return {
          title: 'SahayaBak',
          body: message.length > 100 ? message.slice(0, 97) + '...' : message,
        };
      }
      return {
        title: 'SahayaBak',
        body: position
          ? `${senderName} ${position} pozisyonunda katılım isteği gönderdi.`
          : `${senderName} maçına katılmak istiyor.`,
      };
    default:
      return {
        title: 'SahayaBak',
        body: message ?? 'Yeni bildirim',
      };
  }
}
