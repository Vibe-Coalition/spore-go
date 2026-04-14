import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal, Platform,
} from 'react-native';
import { Question, AnswersData, formatAnswers } from '../utils/questions';
import { useApp, MONO_FONT as MONO } from '../context/AppContext';

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
  const [selected, setSelected] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());

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
      onSubmit(formatAnswers(questions, { answers: newAnswers, notes: {} }));
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
        <View style={[s.sheet, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 12 }}>
              question {currentIdx + 1}/{questions.length}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 12 }}>[cancel]</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: t.fg, fontFamily: MONO, fontSize: 14, marginBottom: 12, lineHeight: 20 }}>{q.text}</Text>

          <ScrollView style={{ maxHeight: 300, marginBottom: 12 }}>
            {q.options ? (
              q.options.map((opt, i) => {
                const isSelected = q.multi ? checked.has(i) : selected === i;
                return (
                  <TouchableOpacity key={i}
                    style={[s.option, { borderColor: isSelected ? t.accent : t.border }]}
                    onPress={() => toggleOption(i)}>
                    <Text style={{ color: isSelected ? t.accent : t.muted, fontFamily: MONO, fontSize: 13, width: 20 }}>
                      {q.multi ? (isSelected ? '[x]' : '[ ]') : (isSelected ? ' ▸' : '  ')}
                    </Text>
                    <Text style={{ color: isSelected ? t.accent : t.fg, fontFamily: MONO, fontSize: 13, flex: 1 }}>{opt}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <TextInput
                style={{ color: t.fg, fontFamily: MONO, fontSize: 13, borderWidth: 1, borderColor: t.border, backgroundColor: t.bgInput, padding: 10, minHeight: 60, textAlignVertical: 'top' }}
                placeholder="type your answer..."
                placeholderTextColor={t.muted}
                value={textInput} onChangeText={setTextInput}
                multiline autoFocus
              />
            )}
          </ScrollView>

          <TouchableOpacity style={[s.submitBtn, { borderColor: t.accent }]} onPress={submitCurrent}>
            <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 14 }}>
              [{isLast ? 'submit' : 'next'}]
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 16, maxHeight: '80%' },
  option: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, marginBottom: 6 },
  submitBtn: { borderWidth: 1, padding: 12, alignItems: 'center' },
});
