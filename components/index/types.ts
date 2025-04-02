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
    districts?: District;
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
    pitches: Pitch;
    users: User;
  }