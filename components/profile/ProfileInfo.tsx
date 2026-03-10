import { useState, useEffect, useCallback } from "react";
import { Text, View, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";

interface ProfileInfoProps {
  userData: any;
  setModalVisible: (visible: boolean) => void;
  setEditModalVisible: () => void;
  pickImage: (fromProfileInfo?: boolean) => Promise<void>;
  onImagePicked?: () => void; // Resim seçildiğinde çağrılacak callback
}

export default function ProfileInfo({ userData, setModalVisible, setEditModalVisible, pickImage, onImagePicked }: ProfileInfoProps) {
    const { t } = useLanguage();

    const [profileImage, setProfileImage] = useState({ uri: userData?.profile_image || null });

    useEffect(() => {
        console.log("🔄 ProfileInfo useEffect tetiklendi");
        console.log("  - userData.profile_image:", userData?.profile_image);
        console.log("  - Mevcut profileImage.uri:", profileImage?.uri);
        
        if (userData?.profile_image) {
            console.log("✅ ProfileInfo: Profil resmi güncelleniyor");
            console.log("  - Eski URI:", profileImage?.uri);
            console.log("  - Yeni URI:", userData.profile_image);
            setProfileImage({ uri: userData.profile_image });
            console.log("  - setProfileImage çağrıldı");
            
            // Güvenlik için ek güncelleme
            setTimeout(() => {
                if (profileImage?.uri !== userData?.profile_image) {
                    console.log("🔄 Güvenlik güncellemesi yapılıyor...");
                    setProfileImage({ uri: userData.profile_image });
                }
            }, 200);
        } else {
            // Eğer profil resmi yoksa, default resmi kullan
            console.log("❌ ProfileInfo: Profil resmi yok, default resim kullanılıyor");
            console.log("  - Eski URI:", profileImage?.uri);
            console.log("  - userData.profile_image:", userData?.profile_image);
            setProfileImage({ uri: null });
            console.log("  - setProfileImage null yapıldı");
            
            // Güvenlik için ek güncelleme
            setTimeout(() => {
                if (profileImage?.uri !== null) {
                    console.log("🔄 Güvenlik güncellemesi yapılıyor (null için)...");
                    setProfileImage({ uri: null });
                }
            }, 200);
            
            // Ek güvenlik için daha uzun gecikme
            setTimeout(() => {
                console.log("🔄 Final güvenlik kontrolü...");
                if (profileImage?.uri !== null) {
                    console.log("🔄 Final güvenlik güncellemesi yapılıyor...");
                    setProfileImage({ uri: null });
                }
            }, 500);
        }
    }, [userData]);

    // Profile sayfasına her dönüşte profil resmini güncelle
    useFocusEffect(
      useCallback(() => {
        console.log("🔄 ProfileInfo: Sayfa odaklandı, profil resmi güncelleniyor...");
        
        if (userData?.profile_image) {
          console.log("✅ ProfileInfo: Profil resmi güncelleniyor:", userData.profile_image);
          setProfileImage({ uri: userData.profile_image });
        } else {
          console.log("❌ ProfileInfo: Profil resmi yok, default resim kullanılıyor");
          setProfileImage({ uri: null });
        }
      }, [userData?.profile_image])
    );

    //console.log("ProfileInfo userData:", userData); // Log eklendi

    return (
        // En dış çerçeveye p-2 padding eklendi
        <View className="flex flex-row p-2 ">
            <View className="w-1/4 py-3 px-1 relative">
                <TouchableOpacity onPress={() => {
                    console.log("Profile resmine tıklandı, modal açılıyor...");
                    setModalVisible(true);
                }}>
                    <Image
                        source={profileImage?.uri ? { uri: profileImage.uri } : require("@/assets/images/ball.png")}
                        className="rounded-full mx-auto"
                        style={{ width: 90, height: 90, resizeMode: 'contain' }}
                    />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={async () => {
                        console.log("Add-circle ile resim yükleniyor...");
                        await pickImage(true); // fromProfileInfo: true
                        // Resim yüklendikten sonra callback çağır
                        if (onImagePicked) {
                            onImagePicked();
                        }
                    }} 
                    className="absolute right-0 bottom-0" 
                    style={{marginBottom: 5}}
                >
                    <View className="bg-white rounded-full p-1 shadow-lg">
                        <Ionicons name="add-circle" size={24} color="green" />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Diğer bilgilerin olduğu kısım %75 */}
            <View className="w-3/4 px-4">
                <View className="w-full">
                    <Text className="font-semibold text-lg text-green-700 my-1">
                        {userData?.name || t('profile.noName')} {userData?.surname || ""}
                    </Text>
                </View>

                <View className="flex-row justify-between mb-1">
                    <Text className="text-wrap font-semibold">{t('profile.age')}:</Text>
                    <Text className="text-green-600 font-semibold"> {userData?.age || "-"}  </Text>
                    <Text className="font-semibold">{t('profile.height')}:</Text>
                    <Text className="text-green-600 font-semibold"> {userData?.height || "-"} {t('units.cm')}  </Text>
                    <Text className="font-semibold">{t('profile.weight')}:</Text>
                    <Text className="text-green-600 font-semibold"> {userData?.weight || "-"} {t('units.kg')}</Text>
                </View>

                <View className="flex-row justify-start mb-1">
                    <Text className="font-semibold">{t('profile.position')}: </Text>
                    <Text className="text-green-600 font-semibold">{userData?.description || t('profile.noDescription')}</Text>
                </View>

                {/* Butonlar */}
                <View className="flex-row mt-1">
                    <View className="w-full">
                        <TouchableOpacity className="bg-green-600 text-white font-semibold rounded-md p-2 items-center mr-1"
                            onPress={() => {
                                console.log("Edit Profile butonuna tıklandı!");
                                setEditModalVisible();
                            }}
                        >
                            <Text className="text-white font-bold">{t('profile.editProfileInfo')}</Text>
                        </TouchableOpacity>
                    </View>
                    {/* <View className="w-1/2">
                        <TouchableOpacity className="bg-green-600 text-white font-semibold rounded-md p-2 items-center">
                            <Text className='text-white font-semibold'>Takip Et</Text>
                        </TouchableOpacity>
                    </View> */}
                </View>
            </View>
        </View>
    );
}
