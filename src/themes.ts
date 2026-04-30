/**
 * Spore Go themes.
 * Simplified color keys for React Native (no Rich/Textual-specific styles).
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
  separator: string;
}

// Extract just the hex color from Rich-style strings like "bold #ff0000" or "italic #abc"
function hex(s: string): string {
  const m = s.match(/#[0-9a-fA-F]{3,8}/);
  return m ? m[0] : s;
}

function theme(
  name: string, icon: string,
  bg: string, bgHeader: string, bgPanel: string,
  fg: string, border: string,
  accent: string, accent2: string,
  success: string, error: string, warning: string, muted: string,
  toolIcon: string, toolDone: string, thinking: string, usage: string,
  planLabelBg: string, planLabel: string,
  execLabelBg: string, execLabel: string,
  separator: string,
): Theme {
  return {
    name, icon,
    bg: hex(bg), bgHeader: hex(bgHeader), bgInput: hex(bgHeader), bgPanel: hex(bgPanel),
    fg: hex(fg), border: hex(border),
    accent: hex(accent), accent2: hex(accent2),
    success: hex(success), error: hex(error), warning: hex(warning), muted: hex(muted),
    toolIcon: hex(toolIcon), toolDone: hex(toolDone),
    thinking: hex(thinking), usage: hex(usage),
    planLabelBg: hex(planLabelBg), planLabel: hex(planLabel),
    execLabelBg: hex(execLabelBg), execLabel: hex(execLabel),
    userBubble: hex(accent),
    separator: hex(separator),
  };
}

export const THEMES: Record<string, Theme> = {
  dark: theme('dark', '🌰', '#1e2030', '#262840', '#262840', '#cdd6f4', '#45475a',
    '#89b4fa', '#cba6f7', '#a6e3a1', '#f38ba8', '#f9e2af', '#6c7086',
    '#f9e2af', '#a6e3a1', '#89b4fa', '#6c7086',
    '#5b5dab', '#ffffff', '#3b7a5a', '#ffffff', '#45475a'),
  oled: theme('oled', '⬛', '#000000', '#0a0a0a', '#0a0a0a', '#e0e0e0', '#333333',
    '#ffffff', '#bbbbbb', '#ffffff', '#ff4444', '#cccccc', '#666666',
    '#cccccc', '#ffffff', '#888888', '#555555',
    '#ffffff', '#000000', '#cccccc', '#000000', '#333333'),
  light: theme('light', '☀️', '#fafafa', '#f0f0f0', '#f0f0f0', '#1a1a2e', '#d4d4d8',
    '#2563eb', '#7c3aed', '#16a34a', '#dc2626', '#ca8a04', '#71717a',
    '#ca8a04', '#16a34a', '#2563eb', '#71717a',
    '#2563eb', '#ffffff', '#16a34a', '#ffffff', '#d4d4d8'),
  oak: theme('oak', '🪵', '#2c2016', '#382a1e', '#382a1e', '#e8d5b7', '#6b5240',
    '#e09060', '#b8a080', '#a3b87a', '#d47070', '#d4a84a', '#8a7560',
    '#d4a84a', '#a3b87a', '#e09060', '#8a7560',
    '#e09060', '#2c2016', '#a3b87a', '#2c2016', '#6b5240'),
  forest: theme('forest', '🌲', '#0c1f14', '#12301e', '#12301e', '#b0d8b0', '#2a5a3a',
    '#50c878', '#78b090', '#70e890', '#e87070', '#e8d060', '#4a7a5a',
    '#e8d060', '#70e890', '#50c878', '#4a7a5a',
    '#50c878', '#0c1f14', '#70e890', '#0c1f14', '#2a5a3a'),
  nord: theme('nord', '❄️', '#2e3440', '#3b4252', '#3b4252', '#d8dee9', '#4c566a',
    '#88c0d0', '#81a1c1', '#a3be8c', '#bf616a', '#ebcb8b', '#616e88',
    '#ebcb8b', '#a3be8c', '#88c0d0', '#616e88',
    '#88c0d0', '#2e3440', '#a3be8c', '#2e3440', '#4c566a'),
  dracula: theme('dracula', '🧛', '#282a36', '#343746', '#343746', '#f8f8f2', '#44475a',
    '#bd93f9', '#ff79c6', '#50fa7b', '#ff5555', '#f1fa8c', '#6272a4',
    '#f1fa8c', '#50fa7b', '#bd93f9', '#6272a4',
    '#bd93f9', '#282a36', '#50fa7b', '#282a36', '#44475a'),
  sunset: theme('sunset', '🌅', '#1a1020', '#241830', '#241830', '#e8d0c0', '#4a2a3a',
    '#ff7b72', '#d2a8ff', '#7ee787', '#ff4466', '#ffa657', '#7a5a6a',
    '#ffa657', '#7ee787', '#d2a8ff', '#7a5a6a',
    '#d2a8ff', '#1a1020', '#7ee787', '#1a1020', '#4a2a3a'),
  ocean: theme('ocean', '🌊', '#0a1628', '#0e2040', '#0e2040', '#a8c8e8', '#1a3a5a',
    '#40b0e0', '#60d0a0', '#60d0a0', '#e06060', '#e0c060', '#4a6a8a',
    '#e0c060', '#60d0a0', '#40b0e0', '#4a6a8a',
    '#40b0e0', '#0a1628', '#60d0a0', '#0a1628', '#1a3a5a'),
  cherry: theme('cherry', '🍒', '#1a0a14', '#2a1020', '#2a1020', '#e8c8d8', '#4a2838',
    '#ff6090', '#c090ff', '#80e0a0', '#ff3060', '#ffc070', '#7a4a60',
    '#ffc070', '#80e0a0', '#ff6090', '#7a4a60',
    '#ff6090', '#1a0a14', '#80e0a0', '#1a0a14', '#4a2838'),
  cyber: theme('cyber', '🔮', '#0a0a12', '#10101a', '#10101a', '#b0f0b0', '#1a2a1a',
    '#00ff88', '#00ccff', '#00ff88', '#ff0055', '#ffcc00', '#3a5a3a',
    '#ffcc00', '#00ff88', '#00ccff', '#3a5a3a',
    '#00ccff', '#0a0a12', '#00ff88', '#0a0a12', '#1a2a1a'),
  gameboy: theme('gameboy', '🎮', '#0f380f', '#306230', '#306230', '#9bbc0f', '#8bac0f',
    '#9bbc0f', '#8bac0f', '#9bbc0f', '#0f380f', '#8bac0f', '#306230',
    '#8bac0f', '#9bbc0f', '#9bbc0f', '#306230',
    '#9bbc0f', '#0f380f', '#8bac0f', '#0f380f', '#8bac0f'),
  amber: theme('amber', '💾', '#0a0800', '#1a1400', '#1a1400', '#ffb000', '#805800',
    '#ffb000', '#cc8800', '#ffb000', '#ff4400', '#cc8800', '#805800',
    '#cc8800', '#ffb000', '#ffb000', '#805800',
    '#ffb000', '#0a0800', '#cc8800', '#0a0800', '#805800'),
  phosphor: theme('phosphor', '📺', '#001100', '#002200', '#002200', '#33ff33', '#116611',
    '#33ff33', '#22cc22', '#33ff33', '#ff3333', '#22cc22', '#116611',
    '#22cc22', '#33ff33', '#33ff33', '#116611',
    '#33ff33', '#001100', '#22cc22', '#001100', '#116611'),
  c64: theme('c64', '🕹️', '#40318d', '#503ca0', '#503ca0', '#a0a0ff', '#7070cc',
    '#a0a0ff', '#7070cc', '#a0a0ff', '#ff5050', '#7070cc', '#6060aa',
    '#7070cc', '#a0a0ff', '#a0a0ff', '#6060aa',
    '#a0a0ff', '#40318d', '#7070cc', '#40318d', '#7070cc'),
  snes: theme('snes', '🎮', '#2a2830', '#343240', '#302e3a', '#d8d4d0', '#4a4850',
    '#b0a0e0', '#6090e0', '#60d060', '#f04040', '#e0c040', '#a09c98',
    '#e0c040', '#60d060', '#b0a0e0', '#a09c98',
    '#8070b0', '#f0ece8', '#409040', '#f0ece8', '#584a70'),
};

export const DEFAULT_THEME = 'dark';

export function getTheme(name: string): Theme {
  return THEMES[name] || THEMES[DEFAULT_THEME];
}

export function listThemes(): string[] {
  return Object.keys(THEMES);
}
