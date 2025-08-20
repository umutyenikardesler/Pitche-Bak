// @/types.ts
export interface User {
    id: string;
    name: string;
    surname: string;
    profile_image?: string;
  }
  
  export interface District {
    name: string;
  }
  
  export interface Pitch {
    name: string;
    address: string;
    price: string;
    features: string[];
    district_id: string;
    latitude?: number;
    longitude?: number;
    districts?: District | District[];
  }
  
  export interface Match {
    id: string;
    title: string;
    time: string;
    date: string;
    prices: string;
    missing_groups: string[];
    create_user: string;
    formattedDate?: string;
    startFormatted?: string;
    endFormatted?: string;
    pitches: Pitch | Pitch[];
    users: User | User[];
  }

  export interface UserProfile {
    id: string;
    name: string;
    surname: string;
    email?: string;
    profile_image?: string;
    age?: number;
    height?: number;
    weight?: number;
    description?: string;
  }
  
  export interface ProfilePreviewProps {
    userId: string;
    onClose: () => void;
    isVisible: boolean;
  }