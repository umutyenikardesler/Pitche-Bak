import { View, Text, TouchableOpacity } from "react-native";

interface ProfileStatusProps {
  matchCount?: number;
  followerCount?: number;
  followingCount?: number;
  onPressFollowers: () => void;
  onPressFollowing: () => void;
}

export default function ProfileStatus({
  matchCount = 0,
  followerCount = 0,
  followingCount = 0,
  onPressFollowers,
  onPressFollowing,
}: ProfileStatusProps) {
  return (
    <View className="flex-row justify-between mx-4 mb-1">
      <View className="">
        <View className="pb-1 px-6 items-center">
          <Text className="font-bold text-xl"> {matchCount} </Text>
          <Text className="font-bold text-green-700">Maç</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onPressFollowers}>
        <View className="pb-1 px-6 items-center">
          <Text className="font-bold text-xl">{followerCount}</Text>
          <Text className="font-bold text-green-700">Takipçi</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={onPressFollowing}>
        <View className="pb-1 px-6 items-center">
          <Text className="font-bold text-xl">{followingCount}</Text>
          <Text className="font-bold text-green-700">Takip</Text>
        </View>
      </TouchableOpacity>

    </View>
  );
}
