import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal,
} from 'react-native';
import { Question, AnswersData, formatAnswers } from '../utils/questions';
import { useApp } from '../context/AppContext';

interface Props {
  questions: Question[];
  onSubmit: (formatted: string) => void;
  onCancel: () => void;
}

export default function QuestionSheet({ questions, onSubmit, onCancel }: Props) {
  const { theme: t } = useApp();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [textInput, setTextInput] = useState('');
  const [selected, setSelected] = useState(0);         // single-select cursor
  const [checked, setChecked] = useState<Set<number>>(new Set()); // multi-select

  const q = questions[currentIdx];
  if (!q) return null;

  const isLast = currentIdx === questions.length - 1;

  const submitCurrent = () => {
    const newAnswers = { ...answers };

    if (q.options && q.multi) {
      const sel = q.options.filter((_, i) => checked.has(i));
      newAnswers[currentIdx] = sel.length ? sel : ['(none)'];
    } else if (q.options) {
      newAnswers[currentIdx] = q.options[selected] || '(none)';
    } else {
      newAnswers[currentIdx] = textInput || '(skipped)';
    }

    setAnswers(newAnswers);

    if (isLast) {
      const data: AnswersData = { answers: newAnswers, notes: {} };
      onSubmit(formatAnswers(questions, data));
    } else {
      setCurrentIdx(currentIdx + 1);
      setSelected(0);
      setChecked(new Set());
      setTextInput('');
    }
  };

  const toggleOption = (idx: number) => {
    if (q.multi) {
      const next = new Set(checked);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      setChecked(next);
    } else {
      setSelected(idx);
    }
  };

  return (
    <Modal transparent animationType="slide">
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: t.bgPanel }]}>
          <View style={s.headerRow}>
            <Text style={[s.counter, { color: t.accent }]}>
              Question {currentIdx + 1}/{questions.length}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: t.muted, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.questionText, { color: t.fg }]}>{q.text}</Text>

          <ScrollView style={s.optionsWrap}>
            {q.options ? (
              q.options.map((opt, i) => {
                const isSelected = q.multi ? checked.has(i) : selected === i;
                return (
                  <TouchableOpacity key={i}
                    style={[s.option, { borderColor: t.border }, isSelected && { borderColor: t.accent, backgroundColor: t.accent + '15' }]}
                    onPress={() => toggleOption(i)}>
                    <View style={[
                      q.multi ? s.checkbox : s.radio,
                      { borderColor: isSelected ? t.accent : t.muted },
                      isSelected && { backgroundColor: t.accent },
                    ]}>
                      {isSelected && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
                    </View>
                    <Text style={[s.optionText, { color: t.fg }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <TextInput
                style={[s.textInput, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput }]}
                placeholder="Type your answer..."
                placeholderTextColor={t.muted}
                value={textInput} onChangeText={setTextInput}
                multiline autoFocus
              />
            )}
          </ScrollView>

          <TouchableOpacity style={[s.submitBtn, { backgroundColor: t.accent }]} onPress={submitCurrent}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{isLast ? 'Submit' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '80%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  counter: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  questionText: { fontSize: 17, fontWeight: '600', marginBottom: 16, lineHeight: 24 },
  optionsWrap: { marginBottom: 16, maxHeight: 300 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  optionText: { fontSize: 15, flex: 1, lineHeight: 20 },
  textInput: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 10, padding: 15, alignItems: 'center' },
});
