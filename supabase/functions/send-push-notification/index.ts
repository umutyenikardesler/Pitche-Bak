// @ts-nocheck
// Supabase Edge Function: send-push-notification
// Tetikleyen: notifications tablosuna INSERT yapıldığında Supabase Database Webhook'u bu endpoint'i çağırır.
//
// Kurulum:
//   Supabase Dashboard → Database → Webhooks → "Create a new hook"
//   Table: notifications | Events: INSERT
//   HTTP Request → URL: https://<project-ref>.supabase.co/functions/v1/send-push-notification
//   Headers: Authorization: Bearer <service_role_key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationRow {
  id: string;
  user_id: string;      // bildirimi alan kullanıcı
  sender_id?: string;
  type: string;
  message?: string;
  match_id?: string;
  is_read: boolean;
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
  if (!notification?.user_id) {
    return new Response('Missing user_id', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Alıcının push token'larını çek
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', notification.user_id);

  if (error || !tokens?.length) {
    return new Response('No tokens found', { status: 200 });
  }

  // Gönderen kullanıcı adını çek (opsiyonel, güzel görüntü için)
  let senderName = 'SahayaBak';
  if (notification.sender_id) {
    const { data: sender } = await supabase
      .from('users')
      .select('name, surname')
      .eq('id', notification.sender_id)
      .single();
    if (sender?.name) {
      senderName = [sender.name, sender.surname].filter(Boolean).join(' ');
    }
  }

  // Bildirim tipine göre başlık ve içerik belirle
  const { title, body } = buildNotificationContent(notification.type, senderName, notification.message);

  // Expo Push API'ye toplu gönderim
  const messages = tokens.map(({ token }) => ({
    to: token,
    title,
    body,
    sound: 'default',
    data: {
      type: notification.type,
      notificationId: notification.id,
      matchId: notification.match_id ?? null,
      senderId: notification.sender_id ?? null,
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
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});

function buildNotificationContent(type: string, senderName: string, message?: string): { title: string; body: string } {
  switch (type) {
    case 'direct_message':
      return {
        title: senderName,
        body: message ? (message.length > 80 ? message.slice(0, 77) + '...' : message) : 'Yeni mesaj',
      };
    case 'follow_request':
      return {
        title: 'SahayaBak',
        body: `${senderName} seni takip etmek istiyor.`,
      };
    case 'follow_accepted':
      return {
        title: 'SahayaBak',
        body: `${senderName} takip isteğini kabul etti.`,
      };
    case 'position_request':
      return {
        title: 'SahayaBak',
        body: `${senderName} maçına katılmak istiyor.`,
      };
    case 'position_accepted':
      return {
        title: 'SahayaBak',
        body: 'Katılım isteğin kabul edildi! Maçını bekliyor.',
      };
    default:
      return {
        title: 'SahayaBak',
        body: message ?? 'Yeni bildirim',
      };
  }
}
