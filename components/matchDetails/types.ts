// MatchDetails için type tanımlamaları
export interface MatchDetailsProps {
  match: any; // Match type'ı index/types.ts'den import edilebilir
  onClose: () => void;
  onOpenProfilePreview?: (userId: string) => void;
}

export interface RejectedPosition {
  position: string;
  message: string;
}

