/**
 * Spore Go themes.
 * Direct mobile mirror of spore-code Theme constants and web base palette tokens.
 * Keep values mechanically diffable with spore-code/internal/app/themes.go.
 */

export interface Theme {
  name: string;
  icon: string;
  bg: string;
  bgHeader: string;
  bgInput: string;
  bgPanel: string;
  fg: string;
  border: string;
  accent: string;
  accent2: string;
  success: string;
  error: string;
  warning: string;
  muted: string;
  toolIcon: string;
  toolDone: string;
  thinking: string;
  usage: string;
  planLabel: string;
  planLabelBg: string;
  execLabel: string;
  execLabelBg: string;
  userBubble: string;
  userBubbleGradientA: string;
  userBubbleGradientB: string;
  userBubbleBorder: string;
  separator: string;
}

function theme(t: Theme): Theme {
  return t;
}

export const THEMES: Record<string, Theme> = {
  dark: theme({ name: "dark", icon: "🌙", bg: "#131511", bgHeader: "#1a1d17", bgInput: "#21241d", bgPanel: "#21241d", fg: "#ece7d5", border: "#2c2f26", accent: "#8eb77c", accent2: "#e38b5f", success: "#8eb77c", error: "#d94e3a", warning: "#e38b5f", muted: "#706c62", toolIcon: "#e3b567", toolDone: "#8eb77c", thinking: "#7aa7d6", usage: "#706c62", planLabel: "#131511", planLabelBg: "#e38b5f", execLabel: "#131511", execLabelBg: "#8eb77c", userBubble: "#8eb77c", userBubbleGradientA: "#443a2c", userBubbleGradientB: "#282e25", userBubbleBorder: "#584534", separator: "#2c2f26" }),
  oled: theme({ name: "oled", icon: "⬛", bg: "#000000", bgHeader: "#0a0a0a", bgInput: "#0a0a0a", bgPanel: "#0a0a0a", fg: "#e0e0e0", border: "#333333", accent: "#ffffff", accent2: "#bbbbbb", success: "#ffffff", error: "#ff4444", warning: "#cccccc", muted: "#666666", toolIcon: "#cccccc", toolDone: "#ffffff", thinking: "#888888", usage: "#555555", planLabel: "#000000", planLabelBg: "#ffffff", execLabel: "#000000", execLabelBg: "#cccccc", userBubble: "#ffffff", userBubbleGradientA: "#2e2219", userBubbleGradientB: "#141814", userBubbleBorder: "#4f3b2c", separator: "#333333" }),
  light: theme({ name: "light", icon: "☀", bg: "#ece7dc", bgHeader: "#f3eddc", bgInput: "#f7f1e0", bgPanel: "#f3eddc", fg: "#1d211b", border: "#d6cdbb", accent: "#b8542a", accent2: "#3a6aa3", success: "#5a7a4a", error: "#b8341c", warning: "#b8542a", muted: "#8a8c82", toolIcon: "#b8542a", toolDone: "#5a7a4a", thinking: "#3a6aa3", usage: "#8a8c82", planLabel: "#f7f1e0", planLabelBg: "#b8542a", execLabel: "#f7f1e0", execLabelBg: "#5a7a4a", userBubble: "#b8542a", userBubbleGradientA: "#e7d3bb", userBubbleGradientB: "#e8e5d0", userBubbleBorder: "#cfb194", separator: "#d6cdbb" }),
};

export const DEFAULT_THEME = 'dark';

export function listThemes(): string[] {
  return ['light', 'dark', 'oled'];
}

export function getTheme(name?: string): Theme {
  return THEMES[name || DEFAULT_THEME] || THEMES[DEFAULT_THEME];
}
