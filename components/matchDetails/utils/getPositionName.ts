// Pozisyon kodlarını tam isimlere çevir
export const getPositionName = (positionCode: string): string => {
  switch (positionCode) {
    case 'K': return 'Kaleci';
    case 'D': return 'Defans';
    case 'O': return 'Orta Saha';
    case 'F': return 'Forvet';
    default: return positionCode;
  }
};

