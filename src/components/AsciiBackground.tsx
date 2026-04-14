import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { MONO_FONT as MONO } from '../context/AppContext';

const GLYPHS = '.:-=+*#%@$&?!;/\\|(){}[]<>~^_01';

export default function AsciiBackground({ color }: { color: string }) {
  const [cells, setCells] = useState<string>('');
  const [dims, setDims] = useState(Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => sub.remove();
  }, []);

  const total = Math.ceil((dims.width / 5.5) * (dims.height / 10.5)) + 500;

  useEffect(() => {
    const make = () => {
      let s = '';
      for (let i = 0; i < total; i++) {
        s += Math.random() > 0.4 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ' ';
      }
      return s;
    };
    setCells(make());

    const timer = setInterval(() => {
      setCells(prev => {
        if (prev.length < total) {
          let s = prev;
          while (s.length < total) s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          return s;
        }
        const arr = prev.split('');
        const mutations = 30 + Math.floor(Math.random() * 40);
        for (let i = 0; i < mutations; i++) {
          const idx = Math.floor(Math.random() * arr.length);
          arr[idx] = Math.random() > 0.35 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ' ';
        }
        return arr.join('');
      });
    }, 150);

    return () => clearInterval(timer);
  }, [total]);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <Text style={{
        fontFamily: MONO, fontSize: 9, lineHeight: 10.5,
        color, opacity: 0.08,
        position: 'absolute', top: 0, left: 0, right: 0,
      }} allowFontScaling={false}>
        {cells}
      </Text>
    </View>
  );
}
