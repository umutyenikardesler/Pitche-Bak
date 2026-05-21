// Pozisyon listesi componenti
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';

interface PositionListProps {
  missingGroups: string[];
  sentRequests: string[];
  acceptedPosition: string | null;
  shownAcceptedPositions: Set<string>;
  completedPositions: Set<string>;
  currentUserId: string | null;
  matchCreateUser: string;
  isLoading: boolean;
  onPositionPress: (position: string) => void;
}

export default function PositionList({
  missingGroups,
  sentRequests,
  acceptedPosition,
  shownAcceptedPositions,
  completedPositions,
  currentUserId,
  matchCreateUser,
  isLoading,
  onPositionPress,
}: PositionListProps) {
  const { t } = useLanguage();
  const { colors, isDark } = useAppTheme();
  const isOwner = currentUserId === matchCreateUser;
  const hasAnyRequest = sentRequests.length > 0;
  const hasAcceptedPosition = acceptedPosition || shownAcceptedPositions.size > 0;
  const orderedPositions: string[] = ['K', 'D', 'O', 'F'];

  const [chipHeight, setChipHeight] = useState(0);
  const translateY = useSharedValue(0);

  const shouldAnimate =
    !isOwner &&
    !hasAnyRequest &&
    !hasAcceptedPosition &&
    !!missingGroups?.length;

  const shortLabel = (pos: string) => {
    switch (pos) {
      case 'K': return 'KL';
      case 'D': return 'DF';
      case 'O': return 'OS';
      case 'F': return 'FV';
      default:  return pos;
    }
  };

  useEffect(() => {
    if (!shouldAnimate || chipHeight <= 0) {
      cancelAnimation(translateY);
      translateY.value = -chipHeight || -100;
      return;
    }

    const h = chipHeight;
    translateY.value = -h;
    translateY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 950 }),
        withDelay(180, withTiming(-h, { duration: 950 })),
        withDelay(220, withTiming(-h, { duration: 1 })),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(translateY);
    };
  }, [shouldAnimate, chipHeight]);

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View className="flex-row max-w-full items-center justify-center flex-wrap">
      {orderedPositions.map((position) => {
        const group = missingGroups?.find((g) => g.startsWith(position + ':'));
        const count = group ? group.split(':')[1] : null;
        const isMissing = !!group;
        const isCompleted = completedPositions.has(position);

        if (!isMissing && !isCompleted) return null;

        if (isMissing && count != null) {
          const isSent = !isOwner && sentRequests.includes(position);
          const isAcceptedForThisPosition =
            !isOwner &&
            (acceptedPosition === position || shownAcceptedPositions.has(position));
          const isActionable =
            !isOwner &&
            !isLoading &&
            !isSent &&
            !isAcceptedForThisPosition &&
            !hasAnyRequest &&
            !hasAcceptedPosition;

          return (
            <View key={`missing-${position}`} className="flex-row items-center mx-1 mb-2">
              <View
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isActionable ? 0.16 : 0.1,
                  shadowRadius: 4,
                  elevation: isActionable ? 3 : 2,
                }}
              >
                <TouchableOpacity
                  className={`flex-row items-center border-solid border-2 rounded-full p-1 ${
                    isSent
                      ? 'border-green-500 bg-green-100'
                      : isAcceptedForThisPosition
                      ? 'border-blue-500 bg-blue-100'
                      : 'border-green-600'
                  }`}
                  style={{ overflow: 'hidden', position: 'relative', backgroundColor: isSent ? '#dcfce7' : isAcceptedForThisPosition ? '#dbeafe' : colors.surfaceAlt }}
                  onLayout={(event) => {
                    const h = event.nativeEvent.layout.height;
                    if (h > 0 && h !== chipHeight) setChipHeight(h);
                  }}
                  onPress={() => !isOwner && onPositionPress(position)}
                  disabled={isOwner || isLoading}
                >
                  {isActionable && chipHeight > 0 && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        {
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: '#16a34a',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                        },
                        overlayStyle,
                      ]}
                    >
                      <Text className="text-white font-bold text-sm">{t('home.joinChip')}</Text>
                    </Animated.View>
                  )}
                  <View
                    className={`rounded-full py-1 px-1 ${
                      position === 'K'
                        ? 'bg-red-500'
                        : position === 'D'
                        ? 'bg-blue-700'
                        : position === 'O'
                        ? 'bg-green-700'
                        : 'bg-yellow-600'
                    }`}
                  >
                    <Text className="text-white font-bold text-lg px-1.5">{shortLabel(position)}</Text>
                  </View>
                  <Text className="ml-1 mr-1 text-base" style={{ color: (isSent || isAcceptedForThisPosition) && !isDark ? '#111827' : colors.text }}>
                    x <Text className="font-bold" style={{ color: (isSent || isAcceptedForThisPosition) && !isDark ? '#111827' : colors.text }}>{count}</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        if (isCompleted) {
          return (
            <View
              key={`completed-${position}`}
              className="flex-row items-center mx-0.5 mb-2"
            >
              <TouchableOpacity
                className="flex-row items-center border-solid border-2 border-green-600 rounded-full p-1"
                style={{ backgroundColor: '#dcfce7' }}
                onPress={() => !isOwner && onPositionPress(position)}
                disabled={isOwner || isLoading}
              >
                <View
                  className={`rounded-full py-1 px-1 ${
                    position === 'K'
                      ? 'bg-red-500'
                      : position === 'D'
                      ? 'bg-blue-700'
                      : position === 'O'
                      ? 'bg-green-700'
                      : 'bg-yellow-600'
                  }`}
                >
                  <Text className="text-white font-bold text-lg px-1">{shortLabel(position)}</Text>
                </View>
                <Text className="ml-0.5 font-semibold pr-0.5 text-base text-green-700">
                  Dolu
                </Text>
              </TouchableOpacity>
            </View>
          );
        }

        return null;
      })}
    </View>
  );
}
