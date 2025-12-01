import { useState, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { Match } from "@/components/index/types";

interface EditPositionsModalProps {
  visible: boolean;
  onClose: () => void;
  match: Match;
  onSuccess: () => void;
}

interface PositionCounts {
  K: number;
  D: number;
  O: number;
  F: number;
}

export default function EditPositionsModal({
  visible,
  onClose,
  match,
  onSuccess,
}: EditPositionsModalProps) {
  const { t } = useLanguage();
  const [positionCounts, setPositionCounts] = useState<PositionCounts>({
    K: 0,
    D: 0,
    O: 0,
    F: 0,
  });
  const [loading, setLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [matchFormat, setMatchFormat] = useState<string>('5-5'); // Maç formatı

  // Modal açıldığında veritabanından güncel pozisyon sayılarını yükle
  useEffect(() => {
    if (visible) {
      const loadCurrentPositions = async () => {
        try {
          const { data, error } = await supabase
            .from('match')
            .select('missing_groups, match_format')
            .eq('id', match.id)
            .single();

          if (error) throw error;

          // Match formatını ayarla (varsayılan: 5-5)
          const format = data?.match_format || match.match_format || '5-5';
          setMatchFormat(format);

          const counts: PositionCounts = { K: 0, D: 0, O: 0, F: 0 };
          
          if (Array.isArray(data?.missing_groups)) {
            data.missing_groups.forEach((group: string) => {
              const [position, count] = group.split(":");
              if (position && count) {
                const pos = position as keyof PositionCounts;
                if (pos in counts) {
                  counts[pos] = parseInt(count, 10) || 0;
                }
              }
            });
          }
          
          setPositionCounts(counts);
        } catch (error) {
          console.error('Pozisyon yükleme hatası:', error);
          // Hata durumunda match prop'undan yükle
          const format = match.match_format || '5-5';
          setMatchFormat(format);
          
          const counts: PositionCounts = { K: 0, D: 0, O: 0, F: 0 };
          if (match.missing_groups) {
            match.missing_groups.forEach((group: string) => {
              const [position, count] = group.split(":");
              if (position && count) {
                const pos = position as keyof PositionCounts;
                if (pos in counts) {
                  counts[pos] = parseInt(count, 10) || 0;
                }
              }
            });
          }
          setPositionCounts(counts);
        }
      };

      loadCurrentPositions();
    }
  }, [visible, match.id, match.missing_groups]);

  // Maç saati başlamasına 30 dakika kontrolü
  useEffect(() => {
    if (visible) {
      const checkEditPermission = () => {
        const now = new Date();
        const turkeyOffset = 3; // UTC+3
        const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
        const turkeyNow = new Date(utcNow.getTime() + (turkeyOffset * 3600000));
        
        const today = turkeyNow.toLocaleDateString('en-CA');
        const currentHours = turkeyNow.getHours();
        const currentMinutes = turkeyNow.getMinutes();
        const currentTime = currentHours * 60 + currentMinutes;
        
        // Maç bugünkü mü kontrol et
        if (match.date !== today) {
          setCanEdit(true);
          return;
        }
        
        const [matchHours, matchMinutes] = match.time.split(":").map(Number);
        const matchStartTime = matchHours * 60 + matchMinutes;
        const timeUntilMatch = matchStartTime - currentTime;
        
        // 30 dakika (30) kontrolü
        setCanEdit(timeUntilMatch >= 30);
      };
      
      checkEditPermission();
    }
  }, [visible, match.date, match.time]);

  // Artık match_format veritabanından geliyor, bu fonksiyona gerek yok
  // Ama geriye dönük uyumluluk için bırakıyoruz

  // Maç formatına göre maksimum sayıları belirle
  const getMaxCountForPosition = (position: keyof PositionCounts, format: string): number => {
    switch (format) {
      case '5-5':
        switch (position) {
          case 'K': return 2;
          case 'D': return 3;
          case 'O': return 3;
          case 'F': return 2;
          default: return 1;
        }
      case '6-6':
        switch (position) {
          case 'K': return 2;
          case 'D': return 4;
          case 'O': return 4;
          case 'F': return 2;
          default: return 1;
        }
      case '7-7':
        switch (position) {
          case 'K': return 2;
          case 'D': return 4;
          case 'O': return 4;
          case 'F': return 4;
          default: return 1;
        }
      default:
        return 10; // Fallback
    }
  };

  const handleCountChange = (position: keyof PositionCounts, delta: number) => {
    setPositionCounts((prev) => {
      const newCount = prev[position] + delta;
      if (newCount < 0) return prev;
      
      // Veritabanından gelen match_format'ı kullan
      const maxCount = getMaxCountForPosition(position, matchFormat);
      
      if (newCount > maxCount) return prev;
      
      return { ...prev, [position]: newCount };
    });
  };

  const handleSave = async () => {
    if (!canEdit) {
      Alert.alert("Hata", "Maç başlamasına 30 dakikadan az kaldığı için pozisyonları düzenleyemezsiniz.");
      return;
    }

    setLoading(true);
    try {
      // Yeni missing_groups array'ini oluştur
      const newMissingGroups: string[] = [];
      
      (Object.keys(positionCounts) as Array<keyof PositionCounts>).forEach((pos) => {
        if (positionCounts[pos] > 0) {
          newMissingGroups.push(`${pos}:${positionCounts[pos]}`);
        }
      });

      const { error } = await supabase
        .from('match')
        .update({ missing_groups: newMissingGroups })
        .eq('id', match.id);

      if (error) throw error;

      Alert.alert("Başarılı", "Pozisyon sayıları güncellendi.");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Pozisyon güncelleme hatası:', error);
      Alert.alert("Hata", "Pozisyon sayıları güncellenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const getPositionName = (pos: keyof PositionCounts) => {
    const names = {
      K: "Kaleci",
      D: "Defans",
      O: "Orta Saha",
      F: "Forvet",
    };
    return names[pos];
  };

  const getPositionColor = (pos: keyof PositionCounts) => {
    const colors = {
      K: "bg-red-500",
      D: "bg-blue-700",
      O: "bg-green-700",
      F: "bg-yellow-600",
    };
    return colors[pos];
  };

  if (!canEdit && visible) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-lg p-6 w-full max-w-sm">
            <Text className="text-lg font-bold text-center mb-4">
              Düzenleme Süresi Doldu
            </Text>
            <Text className="text-center text-gray-600 mb-4">
              Maç başlamasına 30 dakikadan az kaldığı için pozisyonları düzenleyemezsiniz.
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-green-600 py-3 rounded-md mt-4"
            >
              <Text className="text-white font-semibold text-center">Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity 
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/50 justify-center items-center px-4"
      >
        <TouchableOpacity 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          className="bg-white rounded-lg p-6 w-full max-w-md"
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold">Pozisyon Sayılarını Düzenle</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-gray-600 mb-4 text-center">
            Her pozisyon için eksik oyuncu sayısını belirleyin
          </Text>

          {(Object.keys(positionCounts) as Array<keyof PositionCounts>).map((pos) => (
            <View key={pos} className="flex-row items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
              <View className="flex-row items-center flex-1">
                <View className={`${getPositionColor(pos)} rounded-full py-2 px-4 mr-3`}>
                  <Text className="text-white font-bold">{pos}</Text>
                </View>
                <Text className="font-semibold flex-1">{getPositionName(pos)}</Text>
              </View>
              
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => {
                    if (positionCounts[pos] > 0) {
                      handleCountChange(pos, -1);
                    }
                  }}
                  className={`rounded-full w-10 h-10 items-center justify-center mr-2 ${
                    positionCounts[pos] === 0 ? 'bg-red-600' : 'bg-gray-300'
                  }`}
                  activeOpacity={positionCounts[pos] === 0 ? 1 : 0.7}
                >
                  <Ionicons name="remove" size={20} color={positionCounts[pos] === 0 ? "#fff" : "#000"} />
                </TouchableOpacity>
                
                <Text className="text-xl font-bold mx-3 min-w-[30px] text-center">
                  {positionCounts[pos]}
                </Text>
                
                <TouchableOpacity
                  onPress={() => {
                    const maxCount = getMaxCountForPosition(pos, matchFormat);
                    if (positionCounts[pos] < maxCount) {
                      handleCountChange(pos, 1);
                    }
                  }}
                  className={`rounded-full w-10 h-10 items-center justify-center ml-2 ${
                    (() => {
                      const maxCount = getMaxCountForPosition(pos, matchFormat);
                      return positionCounts[pos] >= maxCount ? 'bg-green-600' : 'bg-gray-300';
                    })()
                  }`}
                  activeOpacity={(() => {
                    const maxCount = getMaxCountForPosition(pos, matchFormat);
                    return positionCounts[pos] >= maxCount ? 1 : 0.7;
                  })()}
                >
                  <Ionicons 
                    name="add" 
                    size={20} 
                    color={(() => {
                      const maxCount = getMaxCountForPosition(pos, matchFormat);
                      return positionCounts[pos] >= maxCount ? "#fff" : "#000";
                    })()} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View className="flex-row gap-3 mt-6">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 bg-gray-300 py-3 rounded-md"
              disabled={loading}
            >
              <Text className="text-center font-semibold">İptal</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleSave}
              className="flex-1 bg-green-600 py-3 rounded-md"
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center font-semibold">Kaydet</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

