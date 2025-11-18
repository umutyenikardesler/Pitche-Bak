// Durum mesajları componenti (Kabul, Red, Gönderilen istek)
import React from 'react';
import { View, Text, Animated } from 'react-native';
import { getPositionName } from '../utils/getPositionName';

interface StatusMessagesProps {
  acceptedPosition: string | null;
  sentRequests: string[];
  rejectedPosition: { position: string; message: string } | null;
  missingGroups: string[];
  fadeAnim: Animated.Value;
  // Mevcut oturum kullanıcısı ve maçı oluşturan kullanıcı
  // Durum mesajlarını sadece pozisyon isteği GÖNDEREN kullanıcı görmeli,
  // maçı oluşturan kişi görmemeli.
  currentUserId: string | null;
  matchCreateUser: string;
}

export default function StatusMessages({
  acceptedPosition,
  sentRequests,
  rejectedPosition,
  missingGroups,
  fadeAnim,
  currentUserId,
  matchCreateUser,
}: StatusMessagesProps) {
  const isRequester =
    !!currentUserId && currentUserId !== matchCreateUser;

  return (
    <>
      {/* Kadro tamamsa göster */}
      {(!missingGroups || missingGroups.length === 0) && (
        <View className="mt-2 mb-2">
          <Animated.Text 
            className="text-white p-2 px-3 bg-green-600 font-bold text-sm rounded-md text-center mx-auto"
            style={{ opacity: fadeAnim }}
          >
            Maç kadrosu tamamlanmıştır! 🎉
          </Animated.Text>
        </View>
      )}
      
      {/* Kabul Edilen İstek için Başarı Mesajı */}
      {isRequester && acceptedPosition && (
        <View className="mt-3 mb-1">
          <View className="bg-green-200 border border-green-400 rounded-lg p-2">
            <Text className="text-green-800 text-center font-bold text-lg">
              🎉 {getPositionName(acceptedPosition)} olarak maça katılım sağladınız!
            </Text>
          </View>
        </View>
      )}

      {/* Gönderilen İstek için Durum Mesajı (sadece en son) */}
      {isRequester && sentRequests.length > 0 && !acceptedPosition && !rejectedPosition && (
        <View className="mt-2">
          <View className="bg-green-100 border border-green-300 rounded-lg p-2">
            <Text className="text-green-700 text-center font-semibold">
              {getPositionName(sentRequests[0])} olarak maça katılma istediğin gönderildi.
            </Text>
          </View>
        </View>
      )}

      {/* Red Edilen İstek için Durum Mesajı (sadece en son) */}
      {isRequester && rejectedPosition && (
        <View className="mt-3 mb-1">
          <View className="bg-red-200 border border-red-400 rounded-lg p-2">
            <Text className="text-red-800 text-center font-bold text-lg">
              ❌ {getPositionName(rejectedPosition.position)} pozisyonu için maça kabul edilmediniz.
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

