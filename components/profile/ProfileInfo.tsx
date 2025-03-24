import { useState, useEffect } from "react";
import { Text, View, Image, TouchableOpacity, Modal, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/services/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function ProfileInfo() {
    const [modalVisible, setModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [profileImage, setProfileImage] = useState({ uri: null }); // Başlangıç değeri
    const searchParams = useLocalSearchParams();

    const [userData, setUserData] = useState({
        id: "",
        name: "",
        surname: "",
        age: "",
        height: "",
        weight: "",
        profile_image: "",
        description: "",
    });

    useEffect(() => {
        fetchUserData();
    }, []);

    useEffect(() => {
        if (userData.profile_image) {
            setProfileImage({ uri: userData.profile_image });
        }
    }, [userData.profile_image]); // Kullanıcı verileri güncellenince profil resmini ayarla

    const fetchUserData = async () => {
        try {
            let userIdToFetch = searchParams.userId || (await supabase.auth.getUser()).data?.user?.id;
            if (!userIdToFetch) {
                console.error("Kullanıcı ID alınamadı!");
                return;
            }

            const { data: userInfo, error: userError } = await supabase
                .from("users")
                .select("*")
                .eq("id", userIdToFetch)
                .single();

            if (userError) {
                console.error("Kullanıcı bilgileri çekilirken hata oluştu:", userError.message);
                return;
            }

            if (userInfo) {
                setUserData(userInfo);
                setProfileImage({ uri: userInfo.profile_image || "" }); // Eğer profil resmi yoksa boş string
            }
        } catch (err) {
            console.error("fetchUserData hata oluştu:", err);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const fileName = `profile_${Date.now()}.jpg`;
            const filePath = `${userData.id}/${fileName}`;

            const { error } = await supabase.storage.from("pictures").upload(filePath, { uri, type: "image/jpeg", name: fileName });

            if (error) {
                Alert.alert("Hata", "Resim yüklenirken bir hata oluştu.");
                return;
            }

            const { data: publicURLData } = supabase.storage.from("pictures").getPublicUrl(filePath);
            setProfileImage({ uri: publicURLData.publicUrl });

            await supabase.from("users").update({ profile_image: publicURLData.publicUrl }).eq("id", userData.id);
            fetchUserData();
        }
    };

    const handleSave = async () => {
        const { error } = await supabase.from("users").update(userData).eq("id", userData.id);
        if (!error) {
            setEditModalVisible(false);
            fetchUserData();
        }
    };

    return (
        <View className="p-4">
            {/* Profil Bilgileri */}
            <View className="flex-row">
                <View className='w-1/4'>
                    <TouchableOpacity onPress={() => setModalVisible(true)}>
                        <View className="justify-center px-4 py-3">
                            <Image
                                // source={profileImage.uri ? { uri: profileImage.uri } : require("@/assets/images/ball.png")}
                                source={userData.profile_image ? { uri: userData.profile_image } : require("@/assets/images/ball.png")}
                                className="rounded-full mx-auto"
                                style={{ width: 90, height: 90, resizeMode: 'contain' }}
                            />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={pickImage} className="static">
                        <View className='absolute -bottom-1 -right-3 m-1'>
                            <Ionicons name="add-circle" size={28} color="green" className='bg-white rounded-full p-1' />
                        </View>
                    </TouchableOpacity>

                </View>
                <View className='w-3/4 flex-col mb-2 px-2'>

                    <View className='w-full '>
                        <Text className='pl-4 py-2 font-semibold text-xl text-green-700'> {userData.name} {userData.surname} </Text>
                    </View>

                    <View className='px-5 mb-2 flex-row justify-between'>
                        <Text className='text-wrap font-semibold'>Yaş:</Text>
                        <Text className='text-green-600 font-semibold'> {userData.age}, </Text>
                        <Text className='font-semibold'>Boy:</Text>
                        <Text className='text-green-600 font-semibold'> {userData.height} cm, </Text>
                        <Text className=' font-semibold'>Ağırlık:</Text>
                        <Text className='text-green-600 font-semibold'> {userData.weight} kg</Text>
                    </View>
                    <View>
                        <Text className='px-5 mb-2 text-wrap font-semibold'>{userData.description}</Text>
                    </View>

                    <View className='flex-row justify-between items-center mx-4 mt-2'>
                        <View className='mx-1 w-1/2'>
                            <TouchableOpacity className="text-center bg-green-600 text-white font-semibold rounded-md px-1 items-center"
                                onPress={() => setEditModalVisible(true)}>
                                <Text className="text-white font-semibold text-center p-1">Düzenle</Text>
                            </TouchableOpacity>
                        </View>
                        <View className='mx-1 w-1/2'>
                            <TouchableOpacity className="text-center bg-green-600 text-white font-semibold rounded-md px-1 items-center"
                            >
                                <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-1 items-center'>Takip Et</Text>
                            </TouchableOpacity>
                        </View>
                        {/* <View className='mx-1'>
                            <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-3 items-center'>Mesaj At</Text>
                        </View> */}
                    </View>

                </View>
            </View>

            {/* Profil Fotoğrafı Modalı */}
            <Modal
                visible={modalVisible}
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    className='flex-1 justify-center items-center bg-white/95'
                    activeOpacity={1}
                    onPressOut={() => setModalVisible(false)}
                >
                    <TouchableOpacity activeOpacity={1} >
                        <Image
                            source={profileImage.uri ? { uri: profileImage.uri } : require("@/assets/images/ball.png")} // Koşullu gösterim
                            style={{ width: 280, height: 280, resizeMode: 'contain' }}
                            className='rounded-full'
                        />
                        <TouchableOpacity onPress={pickImage} className="static">
                            <View className='absolute -bottom-5 right-[7%] m-3 shadow-slate-600'>
                                <View className='p-2 bg-white rounded-full '>
                                    <Ionicons name="color-wand" size={22} color="white" className='bg-green-700 rounded-full p-3' />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Bilgi Düzenleme Modalı */}
            <Modal visible={editModalVisible} transparent={true} animationType="fade">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View className="flex-1 justify-center items-center bg-black/50">
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            className="w-full"
                        >
                            <ScrollView
                                contentContainerStyle={{ justifyContent: "center", alignItems: "center", padding: 10 }}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View className="bg-white p-6 rounded-lg w-3/4">
                                    <Text className="text-xl font-bold text-center text-green-700 mb-4">Kişisel Bilgilerini Tamamla</Text>

                                    <TextInput placeholder="Adınız" value={userData.name} onChangeText={(text) => setUserData({ ...userData, name: text })} className="border border-gray-300 rounded p-2 mb-2" />
                                    <TextInput placeholder="Soyadınız" value={userData.surname} onChangeText={(text) => setUserData({ ...userData, surname: text })} className="border border-gray-300 rounded p-2 mb-2" />
                                    <TextInput placeholder="Yaş" value={userData.age?.toString()} onChangeText={(text) => setUserData({ ...userData, age: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                                    <TextInput placeholder="Boy (cm)" value={userData.height?.toString()} onChangeText={(text) => setUserData({ ...userData, height: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                                    <TextInput placeholder="Kilo (kg)" value={userData.weight?.toString()} onChangeText={(text) => setUserData({ ...userData, weight: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                                    <TextInput placeholder="Biyografi" value={userData.description} onChangeText={(text) => setUserData({ ...userData, description: text })} className="border border-gray-300 rounded p-2 mb-2" multiline />

                                    <View className="flex-row justify-between mt-3">
                                        <Text className='text-white bg-red-500 p-2 rounded-lg' onPress={() => setEditModalVisible(false)}> İptal Et </Text>
                                        <Text className='text-white bg-green-600 p-2 rounded-lg' onPress={handleSave}> Kaydet </Text>
                                    </View>
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}
