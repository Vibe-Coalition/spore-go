/**
 * Minimal markdown renderer — zero dependencies, covers 90% of agent responses.
 * Handles: headers, bold, italic, inline code, code blocks, bullets, numbered lists, blockquotes, horizontal rules.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp, MONO_FONT } from '../context/AppContext';

interface Props {
  children: string;
}

export default function MarkdownText({ children }: Props) {
  const { theme: t } = useApp();
  const lines = children.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <View key={elements.length} style={[s.codeBlock, { backgroundColor: t.bg, borderColor: t.border }]}>
          <Text style={{ fontFamily: MONO_FONT, fontSize: 11, color: t.accent, lineHeight: 16 }}>
            {codeLines.join('\n')}
          </Text>
        </View>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$|^\*\*\*+$|^___+$/.test(line.trim())) {
      elements.push(<View key={elements.length} style={[s.hr, { backgroundColor: t.border }]} />);
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<View key={elements.length} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Headers
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const size = level === 1 ? 17 : level === 2 ? 15 : 13;
      elements.push(
        <Text key={elements.length} style={{ fontFamily: MONO_FONT, fontSize: size, fontWeight: '700', color: t.fg, marginVertical: 3 }}>
          {renderInline(hMatch[2], t)}
        </Text>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith('> ')) {
      elements.push(
        <View key={elements.length} style={[s.blockquote, { borderLeftColor: t.accent }]}>
          <Text style={{ fontFamily: MONO_FONT, fontSize: 12, color: t.muted, lineHeight: 18 }}>
            {renderInline(line.replace(/^>\s*/, ''), t)}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*+]\s/.test(line)) {
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const text = line.replace(/^\s*[-*+]\s+/, '');
      elements.push(
        <Text key={elements.length} style={{ fontFamily: MONO_FONT, fontSize: 12, color: t.fg, lineHeight: 18, paddingLeft: 4 + indent * 8 }}>
          <Text style={{ color: t.accent }}>• </Text>{renderInline(text, t)}
        </Text>
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^\s*(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      elements.push(
        <Text key={elements.length} style={{ fontFamily: MONO_FONT, fontSize: 12, color: t.fg, lineHeight: 18, paddingLeft: 4 }}>
          <Text style={{ color: t.accent }}>{numMatch[1]}. </Text>{renderInline(numMatch[2], t)}
        </Text>
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text key={elements.length} style={{ fontFamily: MONO_FONT, fontSize: 12, color: t.fg, lineHeight: 18 }}>
        {renderInline(line, t)}
      </Text>
    );
    i++;
  }

  return <View>{elements}</View>;
}

/** Render inline markdown: bold, italic, code, links */
function renderInline(text: string, t: any): React.ReactNode {
  // Split on inline patterns, preserving order
  const parts: React.ReactNode[] = [];
  // Regex: `code`, **bold**, *italic*, [link](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const m = match[0];
    if (m.startsWith('`')) {
      // Inline code
      parts.push(
        <Text key={parts.length} style={{ fontFamily: MONO_FONT, fontSize: 11, color: t.accent, backgroundColor: t.bg }}>
          {m.slice(1, -1)}
        </Text>
      );
    } else if (m.startsWith('**')) {
      // Bold
      parts.push(
        <Text key={parts.length} style={{ fontWeight: '700' }}>
          {m.slice(2, -2)}
        </Text>
      );
    } else if (m.startsWith('*')) {
      // Italic
      parts.push(
        <Text key={parts.length} style={{ fontStyle: 'italic' }}>
          {m.slice(1, -1)}
        </Text>
      );
    } else if (m.startsWith('[')) {
      // Link — just show the text part
      const linkText = m.match(/\[([^\]]+)\]/)?.[1] || m;
      parts.push(
        <Text key={parts.length} style={{ color: t.accent, textDecorationLine: 'underline' }}>
          {linkText}
        </Text>
      );
    }
    lastIdx = match.index + m.length;
  }

  // Remaining plain text
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

const s = StyleSheet.create({
  codeBlock: { padding: 8, marginVertical: 4, borderWidth: 1, borderRadius: 2 },
  hr: { height: 1, marginVertical: 6 },
  blockquote: { borderLeftWidth: 2, paddingLeft: 8, marginVertical: 2 },
});
