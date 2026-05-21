import { supabase } from './supabase';

export type PushNotificationRecord = {
  id: string;
  user_id: string;
  sender_id?: string | null;
  type: string;
  message?: string | null;
  match_id?: string | null;
  position?: string | null;
  is_read?: boolean;
};

export async function triggerPushNotification(record: PushNotificationRecord): Promise<void> {
  if (!record?.id || !record?.user_id) return;

  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        type: 'INSERT',
        table: 'notifications',
        schema: 'public',
        record,
      },
    });

    if (error) {
      console.warn('[Push] Edge function hatası:', error.message);
    }
  } catch (err) {
    console.warn('[Push] Edge function çağrılamadı:', err);
  }
}

export async function createNotification(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single();

  if (!error && data) {
    void triggerPushNotification(data as PushNotificationRecord);
  }

  return { data, error };
}
