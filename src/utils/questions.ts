/**
 * Question parser — port of acorn/questions.py
 * Parses structured questions from QUESTIONS: blocks in agent responses.
 */

export interface Question {
  text: string;
  options: string[] | null;
  multi: boolean;
  index: number;
}

export interface AnswersData {
  answers: Record<number, string | string[]>;
  notes: Record<number, string>;
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
      options = multiMatch[1].split(' / ').map(o => o.trim()).filter(Boolean);
      questionText = raw.slice(0, multiMatch.index).trim().replace(/\?$/, '').trim() + '?';
      multi = true;
    } else {
      // Single-select: [opt1 / opt2 / opt3]
      const singleMatch = raw.match(/\[([^\]]+ \/ [^\]]+)\]/);
      if (singleMatch) {
        options = singleMatch[1].split(' / ').map(o => o.trim()).filter(Boolean);
        questionText = raw.slice(0, singleMatch.index).trim().replace(/\?$/, '').trim() + '?';
      } else {
        questionText = raw.replace(/\?$/, '').trim() + '?';
      }
    }

    questions.push({
      text: questionText,
      options: options && options.length > 1 ? options : null,
      multi,
      index: idx,
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
