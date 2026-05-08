import React from 'react';
import { ImageBackground, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Theme } from '../themes';

interface Props {
  theme: Theme;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const LIGHT_BG = require('../../assets/backgrounds/spore-bg-light.png');
const DARK_BG = require('../../assets/backgrounds/spore-bg-dark.png');

function sourceForTheme(themeName: string) {
  return themeName === 'light' ? LIGHT_BG : DARK_BG;
}

/**
 * Static render of the Spore web app graph background.
 *
 * OLED intentionally does not use this image: it stays a flat black/near-black
 * surface so it keeps the battery-friendly, no-glow OLED behavior.
 */
export default function GradientBackground({ theme, children, style }: Props) {
  if (theme.name === 'oled') {
    return <View style={[styles.root, { backgroundColor: theme.bg }, style]}>{children}</View>;
  }

  return (
    <ImageBackground
      source={sourceForTheme(theme.name)}
      resizeMode="cover"
      style={[styles.root, style]}
      imageStyle={styles.image}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
