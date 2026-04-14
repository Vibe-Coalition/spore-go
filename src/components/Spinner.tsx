import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface Props {
  style?: any;
  text?: string;
}

export default function Spinner({ style, text }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);

  return (
    <Text style={style}>
      {FRAMES[frame]}{text ? ` ${text}` : ''}
    </Text>
  );
}
