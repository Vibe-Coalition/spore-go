import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

type Props = {
  size?: number;
  /** Equivalent to the web logo's currentColor: spokes + center. */
  color: string;
  /** Equivalent to the web logo's fixed amber petal fill. */
  accent?: string;
  style?: ViewStyle;
  animated?: boolean;
};

type PetalGeometry = {
  angle: number;
  x: number;
  y: number;
};

const PETAL_COUNT = 6;
const RING_R = 0.62;
const PETAL_R = 0.16;
const CENTER_R = 0.18;
const SPOKE_WIDTH = 0.04;
const DEFAULT_PETAL_COLOR = '#c8762c';
const ANGLES = Array.from(
  { length: PETAL_COUNT },
  (_, i) => -Math.PI / 2 + (i / PETAL_COUNT) * Math.PI * 2,
);

function getPetalGeometry(t: number): PetalGeometry[] {
  return ANGLES.map((angle, i) => {
    const off = Math.sin(t * 1.8 + i * 1.1) * 0.04;
    return {
      angle,
      x: RING_R * Math.cos(angle) + Math.cos(angle + Math.PI / 2) * off,
      y: RING_R * Math.sin(angle) + Math.sin(angle + Math.PI / 2) * off,
    };
  });
}

export default function SporeLogo({ size = 96, color, accent = DEFAULT_PETAL_COLOR, style, animated = true }: Props) {
  const [time, setTime] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!animated) {
      startedAt.current = null;
      setTime(0);
      return undefined;
    }

    let frame: number;
    const step = (now: number) => {
      if (startedAt.current === null) startedAt.current = now;
      setTime((now - startedAt.current) / 1000);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [animated]);

  const geometry = useMemo(() => getPetalGeometry(animated ? time : 0), [animated, time]);
  const viewBoxScale = size / 2;
  const center = size / 2;
  const petalRadius = PETAL_R * viewBoxScale;
  const centerRadius = CENTER_R * viewBoxScale;
  const spokeWidth = Math.max(1, SPOKE_WIDTH * viewBoxScale);

  return (
    <View
      accessibilityLabel="Spore Core"
      style={[styles.root, { width: size, height: size }, style]}
    >
      {geometry.map((petal, i) => {
        const x = center + petal.x * viewBoxScale;
        const y = center + petal.y * viewBoxScale;
        return (
          <View
            key={`spoke-${i}`}
            style={[
              styles.spoke,
              {
                width: Math.hypot(x - center, y - center),
                height: spokeWidth,
                borderRadius: spokeWidth / 2,
                left: center,
                top: center - spokeWidth / 2,
                backgroundColor: color,
                transform: [{ rotate: `${Math.atan2(y - center, x - center)}rad` }],
              },
            ]}
          />
        );
      })}

      {geometry.map((petal, i) => {
        const x = center + petal.x * viewBoxScale;
        const y = center + petal.y * viewBoxScale;
        return (
          <View
            key={`petal-${i}`}
            style={[
              styles.petal,
              {
                width: petalRadius * 2,
                height: petalRadius * 2,
                borderRadius: petalRadius,
                left: x - petalRadius,
                top: y - petalRadius,
                backgroundColor: accent,
              },
            ]}
          />
        );
      })}

      <View
        style={[
          styles.center,
          {
            width: centerRadius * 2,
            height: centerRadius * 2,
            borderRadius: centerRadius,
            left: center - centerRadius,
            top: center - centerRadius,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  spoke: {
    position: 'absolute',
    transformOrigin: 'left center',
  },
  petal: {
    position: 'absolute',
  },
  center: {
    position: 'absolute',
  },
});
