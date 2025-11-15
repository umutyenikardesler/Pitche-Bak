// Notification message builders
import { Notification } from './notificationTypes';

export const getPositionName = (positionCode: string): string => {
    switch (positionCode) {
        case 'K': return 'Kaleci';
        case 'D': return 'Defans';
        case 'O': return 'Orta Saha';
        case 'F': return 'Forvet';
        default: return positionCode;
    }
};

export const formatMatchInfo = (notification: Notification): {
    matchDateStr: string;
    matchTimeStr: string;
    districtName: string;
    pitchName: string;
} => {
    let matchDateStr = '';
    let matchTimeStr = '';
    let districtName = 'Bilinmiyor';
    let pitchName = 'Bilinmiyor';
    
    if (notification.match) {
        const matchDate = new Date(notification.match.date);
        matchDateStr = matchDate.toLocaleDateString("tr-TR");
        const [hours, minutes] = notification.match.time.split(":").map(Number);
        matchTimeStr = `${hours}:${minutes.toString().padStart(2, '0')}-${hours + 1}:${minutes.toString().padStart(2, '0')}`;
        
        districtName = notification.match.pitches?.districts?.name || 'Bilinmiyor';
        pitchName = notification.match.pitches?.name || 'Bilinmiyor';
    }
    
    return { matchDateStr, matchTimeStr, districtName, pitchName };
};

// Follow Request Messages
export const buildFollowRequestAcceptMessage = (senderName: string, senderSurname: string): string => {
    return `${senderName} ${senderSurname} seni takip etmeye başladı.`;
};

export const buildFollowRequestAcceptSenderMessage = (accepterName: string): string => {
    return `${accepterName} takip isteğinizi kabul etti.`;
};

export const buildFollowRequestRejectMessage = (senderName: string, senderSurname: string): string => {
    return `${senderName} ${senderSurname} kullanıcısının takip isteğini reddettiniz.`;
};

export const buildFollowRequestRejectSenderMessage = (rejecterName: string): string => {
    return `${rejecterName} takip isteğinizi reddetti.`;
};

// Join Request Messages
export const buildJoinRequestAcceptMessage = (position: string): string => {
    return `${getPositionName(position)} mevkisine kabul edildiniz`;
};

export const buildJoinRequestAcceptSenderMessage = (
    ownerName: string,
    matchInfo: string,
    position: string
): string => {
    return `${ownerName} kullanıcısının oluşturduğu ${matchInfo} maçı için ${getPositionName(position)} mevkisine kabul edildiniz.`;
};

export const buildJoinRequestRejectMessage = (position: string): string => {
    return `${getPositionName(position)} mevkisine kabul edilmediniz`;
};

export const buildJoinRequestRejectSenderMessage = (
    ownerName: string,
    matchDateStr: string,
    matchTimeStr: string,
    districtName: string,
    pitchName: string,
    position: string
): string => {
    return `${ownerName} kullanıcısının oluşturmuş olduğu ${matchDateStr} ${matchTimeStr}, ${districtName} → ${pitchName} maçı için ${getPositionName(position)} pozisyonuna katılma isteğiniz reddedildi.`;
};

