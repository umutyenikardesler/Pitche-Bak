// Notification types and interfaces
export interface Notification {
    id: string;
    user_id: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: 'follow_request' | 'join_request' | 'direct_message';
    sender_id: string;
    sender_name: string;
    sender_surname: string;
    sender_profile_image?: string;
    match_id?: string;
    position?: string;
    match?: {
        id: string;
        title: string;
        date: string;
        time: string;
        formattedDate: string;
        startFormatted: string;
        endFormatted: string;
        pitches: {
            name: string;
            districts: {
                name: string;
            };
        };
    };
}

export type NotificationGroup = [string, Notification[]];

