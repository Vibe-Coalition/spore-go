import React from 'react';
import { Platform } from 'react-native';
import Markdown from 'react-native-marked';
import { useApp, MONO_FONT } from '../context/AppContext';

interface Props {
  children: string;
}

export default function MarkdownText({ children }: Props) {
  const { theme: t } = useApp();
  const font = MONO_FONT;

  return (
    <Markdown
      value={children}
      flatListProps={{ scrollEnabled: false }}
      theme={{
        colors: {
          text: t.fg,
          code: t.accent,
          link: t.accent,
          border: t.border,
        },
      }}
      styles={{
        text: { fontFamily: font, fontSize: 13, color: t.fg, lineHeight: 19 },
        h1: { fontFamily: font, fontSize: 18, color: t.fg, fontWeight: '700' as const, marginVertical: 6 },
        h2: { fontFamily: font, fontSize: 16, color: t.fg, fontWeight: '700' as const, marginVertical: 4 },
        h3: { fontFamily: font, fontSize: 14, color: t.fg, fontWeight: '600' as const, marginVertical: 3 },
        code: { fontFamily: font, fontSize: 12, color: t.accent, backgroundColor: t.bg, paddingHorizontal: 3 },
        codeBlock: { fontFamily: font, fontSize: 11, color: t.accent, backgroundColor: t.bg, padding: 8, borderRadius: 4 },
        em: { fontStyle: 'italic' as const },
        strong: { fontWeight: '700' as const },
        blockquote: { borderLeftWidth: 2, borderLeftColor: t.accent, paddingLeft: 8 },
        li: { fontFamily: font, fontSize: 13, color: t.fg },
        hr: { backgroundColor: t.border },
      }}
    />
  );
}
