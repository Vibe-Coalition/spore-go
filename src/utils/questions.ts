/**
 * Legacy question parser.
 * Structured ask_user websocket events are preferred; QUESTIONS: blocks remain a fallback.
 */

import { Question, AskUserOption } from '../types';
export type { Question } from '../types';

export interface AnswersData {
  answers: Record<number, string | string[]>;
  notes: Record<number, string>;
}

/** Split on ' / ' but not inside parentheses. */
function splitOptions(s: string): string[] {
  const options: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '(') { depth++; current += s[i]; }
    else if (s[i] === ')') { depth = Math.max(0, depth - 1); current += s[i]; }
    else if (depth === 0 && s.slice(i, i + 3) === ' / ') { options.push(current.trim()); current = ''; i += 3; continue; }
    else { current += s[i]; }
    i++;
  }
  if (current.trim()) options.push(current.trim());
  return options.filter(Boolean);
}

function asOptions(options: string[]): AskUserOption[] {
  return options.map(label => ({ label }));
}

export function optionLabel(option: AskUserOption | string): string {
  return typeof option === 'string' ? option : option.label;
}

export function parseQuestions(text: string): Question[] {
  // Require QUESTIONS: marker
  const blocks = text.split(/(?:^|\n)\s*QUESTIONS?\s*:\s*\n/i);
  if (blocks.length < 2) return [];

  let qText = blocks[blocks.length - 1];

  // Split on blank lines, find first segment with numbered items
  const segments = qText.split(/\n\s*\n/);
  qText = '';
  for (const seg of segments) {
    if (/^\s*\d+\./m.test(seg)) {
      qText = seg;
      break;
    }
  }
  if (!qText) return [];

  const questions: Question[] = [];
  const pattern = /^\s*(\d+)\.\s+(.+?)$/gm;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(qText)) !== null) {
    const idx = parseInt(m[1]);
    const raw = m[2].trim();

    let options: string[] | null = null;
    let multi = false;
    let questionText: string;

    // Multi-select: {opt1 / opt2 / opt3}
    const multiMatch = raw.match(/\{([^}]+ \/ [^}]+)\}/);
    if (multiMatch) {
      options = splitOptions(multiMatch[1]);
      questionText = raw.slice(0, multiMatch.index).trim().replace(/\?$/, '').trim() + '?';
      multi = true;
    } else {
      // Single-select: [opt1 / opt2 / opt3]
      const singleMatch = raw.match(/\[([^\]]+ \/ [^\]]+)\]/);
      if (singleMatch) {
        options = splitOptions(singleMatch[1]);
        questionText = raw.slice(0, singleMatch.index).trim().replace(/\?$/, '').trim() + '?';
      } else {
        questionText = raw.replace(/\?$/, '').trim() + '?';
      }
    }

    questions.push({
      text: questionText,
      options: options && options.length > 1 ? asOptions(options) : null,
      multi,
      index: idx,
      source: 'legacy',
      mode: multi ? 'multi' : options ? 'single' : 'open',
    });
  }

  return questions;
}

export function formatAnswers(questions: Question[], data: AnswersData): string {
  const lines = ['Here are my answers to your questions:\n'];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answer = data.answers[i] ?? '(skipped)';
    const answerStr = Array.isArray(answer) ? answer.join(', ') : String(answer);

    lines.push(`${i + 1}. ${q.text}`);
    lines.push(`   → ${answerStr}`);

    const note = data.notes[i];
    if (note) {
      lines.push(`   Note: ${note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
