// MatchDetails state yönetimi hook'u
import { useState, useEffect } from 'react';
import { Animated } from 'react-native';
import { Match } from '@/components/index/types';

export const useMatchDetailsState = (match: Match) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedPosition, setAcceptedPosition] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [shownAcceptedPositions, setShownAcceptedPositions] = useState<Set<string>>(new Set());
  const [isCancellingPosition, setIsCancellingPosition] = useState(false);
  const [cancelledPositions, setCancelledPositions] = useState<Set<string>>(new Set());
  const [isPitchSummaryExpanded, setIsPitchSummaryExpanded] = useState(false);
  const [rejectedPosition, setRejectedPosition] = useState<{ position: string; message: string } | null>(null);
  const [missingGroups, setMissingGroups] = useState<string[]>(Array.isArray(match.missing_groups) ? match.missing_groups : []);
  const [completedPositions, setCompletedPositions] = useState<Set<string>>(new Set());

  // match değişirse state'i senkronize et
  useEffect(() => {
    setMissingGroups(Array.isArray(match.missing_groups) ? match.missing_groups : []);
    setCompletedPositions(new Set());
  }, [match.id]);

  // Soluk gitgel animasyonu
  useEffect(() => {
    const fadeInOut = () => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => fadeInOut());
    };

    fadeInOut();
  }, [fadeAnim]);

  // Kullanıcı ID'sini al
  useEffect(() => {
    const getCurrentUser = async () => {
      const { supabase } = await import('@/services/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  return {
    currentUserId,
    setCurrentUserId,
    sentRequests,
    setSentRequests,
    isLoading,
    setIsLoading,
    acceptedPosition,
    setAcceptedPosition,
    fadeAnim,
    shownAcceptedPositions,
    setShownAcceptedPositions,
    isCancellingPosition,
    setIsCancellingPosition,
    cancelledPositions,
    setCancelledPositions,
    isPitchSummaryExpanded,
    setIsPitchSummaryExpanded,
    rejectedPosition,
    setRejectedPosition,
    missingGroups,
    setMissingGroups,
    completedPositions,
    setCompletedPositions,
  };
};

