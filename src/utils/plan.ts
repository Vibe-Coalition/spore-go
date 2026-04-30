/**
 * Plan mode constants and utilities.
 */

export const PLAN_PREFIX =
  '[MODE: Plan only. You are in planning mode.\n' +
  'Phase 1 — UNDERSTAND: Read files, search the codebase, and use web_search/web_fetch as needed to fully understand the task. ' +
  'Ask the user clarifying questions if anything is ambiguous — do NOT assume.\n' +
  'Phase 2 — PLAN: Once you have enough context, present a clear step-by-step plan of what you would change and why. ' +
  'Include file paths and describe each change.\n' +
  'RULES: Do NOT make any changes (no write_file, edit_file, or exec). ' +
  'You MAY use read_file, glob, grep, web_search, and web_fetch.\n' +
  'End your plan with the exact line: "PLAN_READY" on its own line so the client knows to prompt for approval.]\n\n';

export const PLAN_EXECUTE_MSG =
  '[The user has approved the plan above. Switch to execute mode and implement it now. ' +
  'Proceed step by step, executing all the changes you outlined.]';

export interface FileSummary {
  creates: string[];
  modifies: string[];
}

export function parseFileSummary(planText: string): FileSummary {
  const createRe = /(?:create|new file|write)\s+[`"]?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)/gi;
  const modifyRe = /(?:modify|edit|update|change)\s+[`"]?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)/gi;

  const noise = new Set(['e.g.', 'i.e.', 'etc.', 'v1.0', 'v2.0', 'PLAN_READY']);
  const creates = new Set<string>();
  const modifies = new Set<string>();

  let m: RegExpExecArray | null;
  while ((m = createRe.exec(planText)) !== null) {
    if (!noise.has(m[1])) creates.add(m[1]);
  }
  while ((m = modifyRe.exec(planText)) !== null) {
    if (!noise.has(m[1])) modifies.add(m[1]);
  }

  // Remove creates from modifies (if mentioned as both)
  for (const f of creates) modifies.delete(f);

  return {
    creates: [...creates].sort(),
    modifies: [...modifies].sort(),
  };
}

export function hasPlanReady(text: string): boolean {
  return text.includes('PLAN_READY');
}
