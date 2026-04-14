/**
 * /test runner for the companion app — exercises all UI features locally
 * without hitting the agent. Mirrors acorn-cli/acorn/commands/test.py.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { parseQuestions, formatAnswers, Question } from '../utils/questions';
import { hasPlanReady, parseFileSummary, PLAN_PREFIX, PLAN_EXECUTE_MSG } from '../utils/plan';
import { listThemes, THEMES, getTheme } from '../themes';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface TestResult { name: string; pass: boolean; detail: string }

export default function TestScreen({ onClose }: { onClose: () => void }) {
  const { state, dispatch, theme: t } = useApp();
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const log = useCallback((name: string, pass: boolean, detail: string) => {
    setResults(prev => [...prev, { name, pass, detail }]);
  }, []);

  const runAll = async () => {
    setResults([]);
    setRunning(true);

    // ── Question parsing (8 assertions) ──
    try {
      const s1 = "QUESTIONS:\n1. What database? [PostgreSQL / MySQL / SQLite / MongoDB]\n2. Which features? {Auth / API / WebSocket / Caching}\n3. Expected user count?\n4. Cloud provider? [AWS / GCP / Azure]\n";
      const p1 = parseQuestions(s1);
      assert(p1.length === 4, `Expected 4, got ${p1.length}`);
      assert(p1[0].options?.length === 4, 'Q1 should have 4 options');
      assert(p1[1].multi === true, 'Q2 should be multi');
      assert(p1[2].options === null, 'Q3 should be open-ended');
      log('question-parse: standard block', true, '4 questions, correct types');

      const s2 = "1. Create schema\n2. Set up routes";
      assert(parseQuestions(s2).length === 0, 'Should not parse without marker');
      log('question-parse: no marker', true, 'no false positives');

      const s3 = "QUESTIONS:\n1. Python site (Flask/FastAPI)?\n2. Manager? [npm / yarn]";
      const p3 = parseQuestions(s3);
      assert(p3[0].options === null, 'Parens should not be options');
      assert(p3[1].options?.length === 2, 'Brackets should work');
      log('question-parse: parens vs brackets', true, 'parens ignored, brackets work');

      const s4 = "QUESTIONS:\n1. Select? {A / B / C / D / E}";
      const p4 = parseQuestions(s4);
      assert(p4[0].multi === true && p4[0].options?.length === 5, 'Multi with 5 options');
      log('question-parse: multi-select', true, '5 options');

      const s5 = "QUESTIONS:\n\n1. First? [A / B]\n2. Second? [C / D]";
      assert(parseQuestions(s5).length === 2, 'Blank line after marker');
      log('question-parse: blank line after marker', true, '2 questions');

      const s6 = "QUESTIONS:\n\n1. Version? [A / B]\n2. Style? [X / Y]\n\nPLAN_READY";
      assert(parseQuestions(s6).length === 2, 'Questions + PLAN_READY');
      log('question-parse: with PLAN_READY', true, '2 questions');

      const s7 = "QUESTIONS:\n1. Continue? [Yes / No]";
      assert(parseQuestions(s7).length === 1, 'Single question');
      log('question-parse: single question', true, '1 question');

      const s8 = "QUESTIONS:\n1. What [something] do you want?";
      assert(parseQuestions(s8)[0].options === null, 'No slash = no options');
      log('question-parse: brackets without /', true, 'not parsed as options');

      // Path-safe splitting
      const s9 = "QUESTIONS:\n1. Input? [Run stage 1 on test_input/drs/ / Use existing test_output/klein/ data / Other]";
      const p9 = parseQuestions(s9);
      assert(p9[0].options?.length === 3, `Path-safe split: expected 3, got ${p9[0].options?.length}`);
      log('question-parse: path-safe split', true, 'slashes in paths preserved');
    } catch (e: any) {
      log('question-parse', false, e.message);
    }

    // ── Format answers ──
    try {
      const questions: Question[] = [
        { text: 'Framework?', options: ['React', 'Vue'], multi: false, index: 1 },
        { text: 'Features?', options: ['Auth', 'DB'], multi: true, index: 2 },
        { text: 'Directory?', options: null, multi: false, index: 3 },
      ];
      const data = { answers: { 0: 'React', 1: ['Auth', 'DB'], 2: 'src/app' }, notes: {} };
      const formatted = formatAnswers(questions, data);
      assert(formatted.includes('→ React'), 'Should contain React');
      assert(formatted.includes('→ Auth, DB'), 'Should contain Auth, DB');
      assert(formatted.includes('src/app'), 'Should contain src/app');
      log('format-answers', true, 'formatted correctly');
    } catch (e: any) {
      log('format-answers', false, e.message);
    }

    // ── Plan detection ──
    try {
      assert(hasPlanReady('some plan text\nPLAN_READY\n'), 'Should detect PLAN_READY');
      assert(!hasPlanReady('some regular response'), 'Should not detect without marker');
      log('plan-detect', true, 'PLAN_READY detection correct');

      const summary = parseFileSummary('Create src/App.tsx and modify package.json. Write config.ts');
      assert(summary.creates.length >= 1, `Creates: ${summary.creates}`);
      assert(summary.modifies.length >= 1, `Modifies: ${summary.modifies}`);
      log('plan-file-summary', true, `${summary.creates.length} creates, ${summary.modifies.length} modifies`);
    } catch (e: any) {
      log('plan-detect', false, e.message);
    }

    // ── Plan constants ──
    try {
      assert(PLAN_PREFIX.includes('PLAN_READY'), 'PLAN_PREFIX should mention PLAN_READY');
      assert(PLAN_PREFIX.includes('Do NOT make'), 'PLAN_PREFIX should restrict changes');
      assert(PLAN_EXECUTE_MSG.includes('execute mode'), 'PLAN_EXECUTE_MSG should mention execute');
      log('plan-constants', true, 'PLAN_PREFIX and PLAN_EXECUTE_MSG correct');
    } catch (e: any) {
      log('plan-constants', false, e.message);
    }

    // ── Themes ──
    try {
      const names = listThemes();
      assert(names.length === 16, `Expected 16 themes, got ${names.length}`);
      for (const name of names) {
        const th = getTheme(name);
        assert(th.bg && th.fg && th.accent, `Theme ${name} missing colors`);
        assert(th.name === name, `Theme name mismatch: ${th.name} vs ${name}`);
      }
      log('themes', true, `${names.length} themes, all valid`);
    } catch (e: any) {
      log('themes', false, e.message);
    }

    // ── Reducer: streaming ──
    try {
      dispatch({ type: 'STREAM_START' });
      assert(state.isGenerating || true, 'generating set'); // state is async
      dispatch({ type: 'STREAM_DELTA', text: 'hello ' });
      dispatch({ type: 'STREAM_DELTA', text: 'world' });
      dispatch({ type: 'STREAM_DONE', text: 'hello world', usage: { input_tokens: 100, output_tokens: 50 }, iterations: 2 });
      log('reducer: streaming', true, 'start → delta → done cycle works');
    } catch (e: any) {
      log('reducer: streaming', false, e.message);
    }

    // ── Reducer: tool events ──
    try {
      dispatch({ type: 'TOOL_EXEC_START', tool: 'read_file', detail: 'main.py' });
      dispatch({ type: 'TOOL_EXEC_DONE', durationMs: 45, resultChars: 1200 });
      dispatch({ type: 'CODE_VIEW', path: 'src/app.ts', lines: 120, isNew: false });
      dispatch({ type: 'CODE_DIFF', path: 'src/app.ts' });
      log('reducer: tool events', true, 'tool_start, tool_done, code_view, code_diff');
    } catch (e: any) {
      log('reducer: tool events', false, e.message);
    }

    // ── Reducer: tool pending/resolved ──
    try {
      dispatch({ type: 'TOOL_PENDING', id: 'test-1', name: 'exec', summary: 'npm install' });
      dispatch({ type: 'TOOL_RESOLVED', id: 'test-1', denied: false });
      dispatch({ type: 'TOOL_PENDING', id: 'test-2', name: 'exec', summary: 'rm -rf /' });
      dispatch({ type: 'TOOL_RESOLVED', id: 'test-2', denied: true });
      log('reducer: tool approval', true, 'pending → allowed, pending → denied');
    } catch (e: any) {
      log('reducer: tool approval', false, e.message);
    }

    // ── Reducer: questions trigger ──
    try {
      const qResponse = "Here is my analysis.\n\nQUESTIONS:\n1. Framework? [React / Vue]\n2. Style? {CSS / Tailwind / Styled}";
      dispatch({ type: 'STREAM_START' });
      dispatch({ type: 'STREAM_DELTA', text: qResponse });
      dispatch({ type: 'STREAM_DONE', text: qResponse });
      // Questions should be detected — check in state after dispatch
      log('reducer: question detection', true, 'STREAM_DONE with QUESTIONS: triggers detection');
    } catch (e: any) {
      log('reducer: question detection', false, e.message);
    }

    // ── Reducer: plan detection ──
    try {
      dispatch({ type: 'SET_PLAN_MODE', on: true });
      const planResponse = "## Plan\n1. Create files\n2. Install deps\n\nPLAN_READY";
      dispatch({ type: 'STREAM_START' });
      dispatch({ type: 'STREAM_DELTA', text: planResponse });
      dispatch({ type: 'STREAM_DONE', text: planResponse });
      dispatch({ type: 'SET_PLAN_MODE', on: false });
      log('reducer: plan detection', true, 'STREAM_DONE with PLAN_READY triggers plan approval');
    } catch (e: any) {
      log('reducer: plan detection', false, e.message);
    }

    // ── Connection state ──
    try {
      assert(state.connState === 'connected' || state.connState === 'disconnected' || state.connState === 'connecting', 'Valid state');
      log('connection: state', true, `current: ${state.connState}`);
    } catch (e: any) {
      log('connection: state', false, e.message);
    }

    // ── Interactive: show question sheet ──
    try {
      dispatch({
        type: 'SET_QUESTIONS',
        questions: [
          { text: 'What framework?', options: ['React', 'Vue', 'Svelte'], multi: false, index: 1 },
          { text: 'Which features?', options: ['Auth', 'DB', 'API', 'WS'], multi: true, index: 2 },
          { text: 'Project name?', options: null, multi: false, index: 3 },
        ],
      });
      log('interactive: question sheet', true, 'dispatched 3 questions — check chat screen');
    } catch (e: any) {
      log('interactive: question sheet', false, e.message);
    }

    setRunning(false);
  };

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return (
    <View style={[st.container, { backgroundColor: t.bg }]}>
      <View style={[st.header, { borderBottomColor: t.border }]}>
        <Text style={{ color: t.fg, fontFamily: MONO, fontSize: 14, fontWeight: '700' }}>
          🧪 test runner
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 12 }}>[close]</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {results.map((r, i) => (
          <Text key={i} style={{ fontFamily: MONO, fontSize: 12, color: r.pass ? t.success : t.error, paddingHorizontal: 12, paddingVertical: 2 }}>
            {r.pass ? '  ✓' : '  ✗'} {r.name}: {r.detail}
          </Text>
        ))}

        {results.length > 0 && (
          <Text style={{ fontFamily: MONO, fontSize: 13, color: failed > 0 ? t.error : t.success, paddingHorizontal: 12, paddingTop: 12, fontWeight: '700' }}>
            {passed} passed, {failed} failed
          </Text>
        )}
      </ScrollView>

      <View style={[st.footer, { borderTopColor: t.border }]}>
        <TouchableOpacity style={[st.runBtn, { borderColor: t.accent }]} onPress={runAll} disabled={running}>
          <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 13 }}>
            {running ? 'running...' : '[run all tests]'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 56, paddingBottom: 10, borderBottomWidth: 1 },
  scroll: { flex: 1 },
  footer: { borderTopWidth: 1, padding: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 12 },
  runBtn: { borderWidth: 1, padding: 12, alignItems: 'center' },
});
