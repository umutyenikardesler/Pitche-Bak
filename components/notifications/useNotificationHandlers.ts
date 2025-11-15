// Custom hook for notification handlers
import React, { useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useNotification } from '@/components/NotificationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Notification } from './notificationTypes';
import {
    getPositionName,
    formatMatchInfo,
    buildFollowRequestAcceptMessage,
    buildFollowRequestAcceptSenderMessage,
    buildFollowRequestRejectMessage,
    buildFollowRequestRejectSenderMessage,
    buildJoinRequestAcceptMessage,
    buildJoinRequestAcceptSenderMessage,
    buildJoinRequestRejectMessage,
    buildJoinRequestRejectSenderMessage,
} from './notificationMessages';

export const useNotificationHandlers = (
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>
) => {
    const { refresh } = useNotification();
    const { t } = useLanguage();

    const handleMarkAsRead = useCallback(async (notification: Notification) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notification.id);

            if (error) throw error;

            setNotifications(prev => prev.map(n => 
                n.id === notification.id ? { ...n, is_read: true } : n
            ));
            
            refresh();
        } catch (error) {
            console.error('Bildirimi okundu olarak işaretleme hatası:', error);
        }
    }, [setNotifications, refresh]);

    const handleFollowRequest = useCallback(async (
        notification: Notification,
        action: 'accept' | 'reject'
    ) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (action === 'accept') {
                // Takip isteğini kabul et
                const { error: updateError } = await supabase
                    .from('follow_requests')
                    .update({ status: 'accepted' })
                    .eq('follower_id', notification.sender_id)
                    .eq('following_id', notification.user_id);

                if (updateError) throw updateError;

                // Bildirimi okundu olarak işaretle
                const acceptMessage = buildFollowRequestAcceptMessage(
                    notification.sender_name,
                    notification.sender_surname
                );
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: acceptMessage
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya kabul bildirimi oluştur
                try {
                    const { data: currentUserData } = await supabase
                        .from('users')
                        .select('name, surname')
                        .eq('id', user.id)
                        .single();
                    
                    const senderName = currentUserData 
                        ? `${currentUserData.name} ${currentUserData.surname}` 
                        : 'Kullanıcı';
                    
                    await supabase.from('notifications').insert({
                        user_id: notification.sender_id,
                        sender_id: user.id,
                        type: 'follow_request',
                        message: buildFollowRequestAcceptSenderMessage(senderName),
                        is_read: false,
                    });
                } catch (e) {
                    console.error('[Notifications] Sender accept notification insert error:', e);
                }

                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: acceptMessage } : n
                ));
                refresh();
                try { (global as any).toast?.show?.('İstek kabul edildi'); } catch (_) {}
            } else {
                // Takip isteğini reddet
                // Önce mevcut kaydı kontrol et
                const { data: existingRequest } = await supabase
                    .from('follow_requests')
                    .select('*')
                    .eq('follower_id', notification.sender_id)
                    .eq('following_id', notification.user_id)
                    .maybeSingle();

                // Takip isteğini sil
                const { error: deleteError } = await supabase
                    .from('follow_requests')
                    .delete()
                    .eq('follower_id', notification.sender_id)
                    .eq('following_id', notification.user_id);

                if (deleteError) throw deleteError;

                // Bildirimi okundu olarak işaretle
                const rejectMessage = buildFollowRequestRejectMessage(
                    notification.sender_name,
                    notification.sender_surname
                );
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: rejectMessage
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya red bildirimi oluştur
                try {
                    const { data: currentUserData } = await supabase
                        .from('users')
                        .select('name, surname')
                        .eq('id', user.id)
                        .single();
                    
                    const senderName = currentUserData 
                        ? `${currentUserData.name} ${currentUserData.surname}` 
                        : 'Kullanıcı';
                    
                    await supabase.from('notifications').insert({
                        user_id: notification.sender_id,
                        sender_id: user.id,
                        type: 'follow_request',
                        message: buildFollowRequestRejectSenderMessage(senderName),
                        is_read: false,
                    });
                } catch (e) {
                    console.error('[Notifications] Sender reject notification insert error:', e);
                }

                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: rejectMessage } : n
                ));
                refresh();
                try { (global as any).toast?.show?.('İstek reddedildi'); } catch (_) {}
            }
        } catch (error) {
            console.error(t('notifications.followRequestError'), error);
        }
    }, [setNotifications, refresh, t]);

    const handleJoinRequest = useCallback(async (
        notification: Notification,
        action: 'accept' | 'reject'
    ) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (action === 'accept') {
                // Maç verilerini al
                const { data: matchData, error: matchError } = await supabase
                    .from('match')
                    .select('missing_groups')
                    .eq('id', notification.match_id)
                    .single();

                if (matchError) throw matchError;

                // Eksik kadro sayılarını güncelle
                const updatedGroups: string[] = (matchData?.missing_groups || []).map((group: string) => {
                    const [position, count] = group.split(':');
                    if (position === notification.position) {
                        const newCount = Math.max(0, parseInt(count, 10) - 1);
                        return newCount > 0 ? `${position}:${newCount}` : '';
                    }
                    return group;
                }).filter((g: string) => !!g);

                // Maç verilerini güncelle
                const { error: updateMatchError } = await supabase
                    .from('match')
                    .update({ missing_groups: updatedGroups })
                    .eq('id', notification.match_id);

                if (updateMatchError) throw updateMatchError;

                // Bildirimi okundu olarak işaretle
                const acceptMessage = buildJoinRequestAcceptMessage(notification.position || '');
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: acceptMessage
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya kabul bildirimi oluştur
                try {
                    const { data: matchOwnerData } = await supabase
                        .from('users')
                        .select('name, surname')
                        .eq('id', user.id)
                        .single();
                    
                    const ownerName = matchOwnerData 
                        ? `${matchOwnerData.name} ${matchOwnerData.surname}` 
                        : 'Kullanıcı';
                    
                    // Maç bilgilerini formatla
                    let matchInfo = 'bilinmeyen maç';
                    if (notification.match) {
                        const matchDate = new Date(notification.match.date);
                        const formattedDate = matchDate.toLocaleDateString("tr-TR");
                        const [hours, minutes] = notification.match.time.split(":").map(Number);
                        const startFormatted = `${hours}:${minutes.toString().padStart(2, '0')}`;
                        const endFormatted = `${hours + 1}:${minutes.toString().padStart(2, '0')}`;
                        
                        const districtName = notification.match.pitches?.districts?.name || 'Bilinmiyor';
                        const pitchName = notification.match.pitches?.name || 'Bilinmiyor';
                        
                        matchInfo = `${formattedDate} ${startFormatted}-${endFormatted} ${districtName} → ${pitchName}`;
                    }
                    
                    await supabase.from('notifications').insert({
                        user_id: notification.sender_id,
                        sender_id: user.id,
                        type: 'join_request',
                        message: buildJoinRequestAcceptSenderMessage(ownerName, matchInfo, notification.position || ''),
                        match_id: notification.match_id,
                        position: notification.position,
                        is_read: false,
                    });
                } catch (e) {
                    console.error('[Notifications] Sender accept notification insert error:', e);
                }

                     setNotifications(prev => prev.map(n =>
                    n.id === notification.id ? { ...n, is_read: true, message: acceptMessage } : n
                ));
                refresh();

                     // MatchDetails ekranını tetikle - global event bus
                     try {
                         const { emitMatchStatus } = require('@/components/matchDetails/matchStatusEventBus');
                         if (notification.match_id && notification.position) {
                             emitMatchStatus(notification.match_id, {
                                 acceptedPosition: notification.position,
                             });
                             console.log('[Notifications] MatchStatusEventBus - accept emit edildi', {
                                 matchId: notification.match_id,
                                 acceptedPosition: notification.position,
                             });
                         }
                     } catch (error) {
                         console.error('[Notifications] MatchStatusEventBus accept emit hatası:', error);
                     }
            } else {
                // Katılım isteğini reddet
                const rejectMessage = buildJoinRequestRejectMessage(notification.position || '');
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: rejectMessage
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya red bildirimi oluştur
                let senderMessage = '';
                try {
                    const { data: matchOwnerData } = await supabase
                        .from('users')
                        .select('name, surname')
                        .eq('id', user.id)
                        .single();
                    
                    const ownerName = matchOwnerData 
                        ? `${matchOwnerData.name} ${matchOwnerData.surname}` 
                        : 'Kullanıcı';
                    
                    const { matchDateStr, matchTimeStr, districtName, pitchName } = formatMatchInfo(notification);
                    senderMessage = buildJoinRequestRejectSenderMessage(
                        ownerName,
                        matchDateStr,
                        matchTimeStr,
                        districtName,
                        pitchName,
                        notification.position || ''
                    );
                    
                    const { error: insertError } = await supabase.from('notifications').insert({
                        user_id: notification.sender_id,
                        sender_id: user.id,
                        type: 'join_request',
                        message: senderMessage,
                        match_id: notification.match_id,
                        position: notification.position,
                        is_read: false,
                    });
                    
                    if (insertError) {
                        console.error('[Notifications] Sender reject notification insert error:', insertError);
                        throw insertError;
                    }
                    
                    console.log('[Notifications] Red bildirimi başarıyla oluşturuldu, event emit ediliyor...');
                } catch (e) {
                    console.error('[Notifications] Sender reject notification insert error:', e);
                    // Hata durumunda fallback mesaj oluştur
                    senderMessage = `${getPositionName(notification.position || '')} pozisyonu için maça kabul edilmediniz.`;
                }

                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: rejectMessage } : n
                ));
                refresh();
                
                // MatchDetails ekranını tetikle - global event bus
                try {
                    const { emitMatchStatus } = require('@/components/matchDetails/matchStatusEventBus');
                    if (notification.match_id && notification.position) {
                        emitMatchStatus(notification.match_id, {
                            rejectedPosition: notification.position,
                        });
                        console.log('[Notifications] MatchStatusEventBus - reject emit edildi', {
                            matchId: notification.match_id,
                            rejectedPosition: notification.position,
                        });
                    } else {
                        console.warn('[Notifications] MatchStatusEventBus emit edilemedi - match_id veya position eksik:', {
                            match_id: notification.match_id,
                            position: notification.position,
                        });
                    }
                } catch (error) {
                    console.error('[Notifications] MatchStatusEventBus reject emit hatası:', error);
                }
                
                try { (global as any).toast?.show?.('İstek reddedildi'); } catch (_) {}
            }
        } catch (error) {
            console.error('Katılım isteği işleme hatası:', error);
        }
    }, [setNotifications, refresh]);

    return {
        handleMarkAsRead,
        handleFollowRequest,
        handleJoinRequest,
    };
};

