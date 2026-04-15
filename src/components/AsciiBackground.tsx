import React, { useEffect, useRef, useMemo, useState, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { MONO_FONT as MONO } from '../context/AppContext';

const GLYPHS = '.:-=+*#%@$&?!;/\\|(){}[]<>~^_01';

function generateLayer(total: number): string {
  const arr = new Array(total);
  for (let i = 0; i < total; i++) {
    arr[i] = Math.random() > 0.45 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ' ';
  }
  return arr.join('');
}

function AsciiBackground({ color }: { color: string }) {
  const { width, height } = Dimensions.get('window');
  const total = Math.ceil((width / 5.5) * (height / 10.5)) + 200;

  // Generate multiple layers, cycle through them with crossfade
  const layers = useMemo(() => [
    generateLayer(total),
    generateLayer(total),
    generateLayer(total),
  ], [total]);

  const [current, setCurrent] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const cycle = () => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }).start(() => {
        // Switch layer
        setCurrent(c => (c + 1) % layers.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }).start();
      });
    };

    const timer = setInterval(cycle, 6000);
    return () => clearInterval(timer);
  }, [fadeAnim, layers.length]);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <Animated.Text style={{
        fontFamily: MONO, fontSize: 9, lineHeight: 10.5,
        color,
        opacity: fadeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.03, 0.08],
        }),
        position: 'absolute', top: 0, left: 0, right: 0,
      }} allowFontScaling={false}>
        {layers[current]}
      </Animated.Text>
    </View>
  );
}

export default memo(AsciiBackground);
