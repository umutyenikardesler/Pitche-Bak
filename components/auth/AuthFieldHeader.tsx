import { Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useFrameCallback } from 'react-native-reanimated';
import { useLanguage } from '@/contexts/LanguageContext';

// Header halı saha ölçüleri
const FIELD_HEIGHT = 90;
const BALL_SIZE = 12;
const BALL_PADDING = 6;

/**
 * Auth ekranının üstündeki dekoratif halı saha başlığı.
 *
 * İçindeki top saha sınırlarından sekerek sürekli dolaşır; tüm hareket
 * Reanimated worklet'inde çalıştığı için JS thread'ine dokunmaz.
 * Ekran state'inden bağımsızdır — prop almaz.
 */
export default function AuthFieldHeader() {
  const { t } = useLanguage();

  const headerWidthSV = useSharedValue(0);
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  // px/ms hız bileşenleri
  const ballVX = useSharedValue(0);
  const ballVY = useSharedValue(0);
  const ballRot = useSharedValue(0);

  const rand = (min: number, max: number) => {
    'worklet';
    return min + Math.random() * (max - min);
  };

  const ensureBallInit = () => {
    'worklet';
    const w = headerWidthSV.value || 0;
    if (w <= 0) return;
    if (ballVX.value !== 0 || ballVY.value !== 0) return;

    const minX = BALL_PADDING;
    const maxX = Math.max(minX, w - BALL_SIZE - BALL_PADDING);
    const minY = BALL_PADDING;
    const maxY = Math.max(minY, FIELD_HEIGHT - BALL_SIZE - BALL_PADDING);

    // Başlangıç: ortalara yakın
    ballX.value = (minX + maxX) / 2;
    ballY.value = (minY + maxY) / 2;

    // Rastgele başlangıç hızı (px/ms). 0.06 -> 60px/sn
    const speed = rand(0.05, 0.095);
    const angle = rand(0, Math.PI * 2);
    ballVX.value = Math.cos(angle) * speed;
    ballVY.value = Math.sin(angle) * speed;
  };

  useFrameCallback((frame) => {
    'worklet';
    ensureBallInit();

    const w = headerWidthSV.value || 0;
    if (w <= 0) return;

    const dt = frame.timeSincePreviousFrame ?? 16;

    const minX = BALL_PADDING;
    const maxX = Math.max(minX, w - BALL_SIZE - BALL_PADDING);
    const minY = BALL_PADDING;
    const maxY = Math.max(minY, FIELD_HEIGHT - BALL_SIZE - BALL_PADDING);

    let x = ballX.value + ballVX.value * dt;
    let y = ballY.value + ballVY.value * dt;
    let vx = ballVX.value;
    let vy = ballVY.value;

    const bounceJitter = () => {
      'worklet';
      // Her çarpışmada küçük sapma: “rastgele desen” hissi
      vx *= rand(0.92, 1.08);
      vy *= rand(0.92, 1.08);
      // Diğer eksene küçük itme
      vy += rand(-0.02, 0.02);
      vx += rand(-0.02, 0.02);
      // Çok yavaşlamasın / çok hızlanmasın
      const maxSpeed = 0.12;
      const minSpeed = 0.035;
      const sp = Math.sqrt(vx * vx + vy * vy) || 0.0001;
      const clamped = Math.min(maxSpeed, Math.max(minSpeed, sp));
      vx = (vx / sp) * clamped;
      vy = (vy / sp) * clamped;
    };

    // X çarpışma
    if (x <= minX) {
      x = minX;
      vx = Math.abs(vx);
      bounceJitter();
    } else if (x >= maxX) {
      x = maxX;
      vx = -Math.abs(vx);
      bounceJitter();
    }

    // Y çarpışma
    if (y <= minY) {
      y = minY;
      vy = Math.abs(vy);
      bounceJitter();
    } else if (y >= maxY) {
      y = maxY;
      vy = -Math.abs(vy);
      bounceJitter();
    }

    ballX.value = x;
    ballY.value = y;
    ballVX.value = vx;
    ballVY.value = vy;
    ballRot.value = ballRot.value + (vx * dt) / 6;
  });

  const ballAnimatedStyle = useAnimatedStyle(() => {
    const w = headerWidthSV.value || 0;
    return {
      transform: [
        { translateX: ballX.value },
        { translateY: ballY.value },
        { rotate: `${ballRot.value}rad` },
      ],
      opacity: w > 0 ? 1 : 0,
    };
  });

  return (
    <View
      className="bg-green-700 px-2"
      style={{
        // Topun Y sınırı FIELD_HEIGHT'e göre hesaplandığı için aynı sabiti kullan
        height: FIELD_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
      }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && w > 0) headerWidthSV.value = w;
      }}
    >
      {/* Futbol sahası çizgileri efekti */}
      <View 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.8,
        }}>
        {/* Üst dış çizgi - 1px boşluk ile */}
        <View style={{ 
          position: 'absolute', 
          top: 1, 
          left: 1, 
          right: 1, 
          height: 2, 
          backgroundColor: 'white',
        }} />
        
        {/* Alt dış çizgi - 1px boşluk ile */}
        <View style={{ 
          position: 'absolute', 
          bottom: 1, 
          left: 1, 
          right: 1, 
          height: 2, 
          backgroundColor: 'white',
        }} />
        
        {/* Sol dış çizgi - 1px boşluk ile */}
        <View style={{ 
          position: 'absolute', 
          top: 1, 
          bottom: 1, 
          left: 1, 
          width: 2, 
          backgroundColor: 'white',
        }} />
        
        {/* Sağ dış çizgi - 1px boşluk ile */}
        <View style={{ 
          position: 'absolute', 
          top: 1, 
          bottom: 1, 
          right: 1, 
          width: 2, 
          backgroundColor: 'white',
        }} />
        
        {/* Orta saha çizgisi */}
        <View style={{ 
          position: 'absolute', 
          left: '50%', 
          top: 1, 
          bottom: 1, 
          width: 2, 
          backgroundColor: 'white',
          transform: [{ translateX: -1 }]
        }} />
        
        {/* Orta yuvarlak */}
        <View style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          width: 60, 
          height: 60, 
          borderWidth: 2, 
          borderColor: 'white',
          borderRadius: 30,
          transform: [{ translateX: -30 }, { translateY: -30 }]
        }} />
        
        {/* Sol kale - İç çizgiler (file gibi) */}
        <View style={{
          position: 'absolute',
          left: 1,
          top: '25%',
          bottom: '25%',
          width: 25,
          borderWidth: 2,
          borderColor: 'white',
          borderRightWidth: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
        }} />
        
        {/* Sol ceza sahası - Yan çizgiler (kale yan çizgisinden ayrı) */}
        <View style={{
          position: 'absolute',
          left: 3,
          top: '15%',
          width: 40,
          height: 2,
          backgroundColor: 'white',
        }} />
        <View style={{
          position: 'absolute',
          left: 3,
          bottom: '15%',
          width: 40,
          height: 2,
          backgroundColor: 'white',
        }} />
        
        {/* Sol ceza sahası - Ön çizgi (dikey) */}
        <View style={{
          position: 'absolute',
          left: 42,
          top: '15%',
          bottom: '15%',
          width: 2,
          backgroundColor: 'white',
        }} />
        
        {/* Sol penaltı noktası */}
        <View style={{
          position: 'absolute',
          left: 32,
          top: '50%',
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'white',
          transform: [{ translateX: -2 }, { translateY: -2 }],
        }} />
        
        {/* Sağ kale - İç çizgiler (file gibi) */}
        <View style={{
          position: 'absolute',
          right: 1,
          top: '25%',
          bottom: '25%',
          width: 25,
          borderWidth: 2,
          borderColor: 'white',
          borderLeftWidth: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
        }} />
        
        {/* Sağ ceza sahası - Yan çizgiler (kale yan çizgisinden ayrı) */}
        <View style={{
          position: 'absolute',
          right: 3,
          top: '15%',
          width: 40,
          height: 2,
          backgroundColor: 'white',
        }} />
        <View style={{
          position: 'absolute',
          right: 3,
          bottom: '15%',
          width: 40,
          height: 2,
          backgroundColor: 'white',
        }} />
        
        {/* Sağ ceza sahası - Ön çizgi (dikey) */}
        <View style={{
          position: 'absolute',
          right: 42,
          top: '15%',
          bottom: '15%',
          width: 2,
          backgroundColor: 'white',
        }} />
        
        {/* Sağ penaltı noktası */}
        <View style={{
          position: 'absolute',
          right: 32,
          top: '50%',
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'white',
          transform: [{ translateX: 2 }, { translateY: -2 }],
        }} />
      </View>
      
      {/* İçerik */}
      <View style={{ width: '100%', height: '100%', zIndex: 1, position: 'relative' }}>
       

        {/* Minik top: saha içinde sürekli gezer */}
        <Animated.Image
          source={require('../../assets/images/ball.png')}
          style={[
            {
              position: 'absolute',
              width: BALL_SIZE,
              height: BALL_SIZE,
              zIndex: 2,
            },
            ballAnimatedStyle,
          ]}
          resizeMode="contain"
        />

        {/* SAHAYABAK: sabit */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
          }}
        >
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              letterSpacing: 3,
              fontSize: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.22)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.55)',
              transform: [{ translateX: 1 }],
            }}
          >
            {t('auth.brand')}
          </Text>
        </View>
        
      </View>
    </View>
  );
}
