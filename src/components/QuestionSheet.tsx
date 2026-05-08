import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal, Platform,
} from 'react-native';
import { Question } from '../types';
import { AnswersData, formatAnswers, optionLabel } from '../utils/questions';
import { useApp } from '../context/AppContext';

interface Props {
  questions: Question[];
  onSubmit: (formatted: string, rawAnswer?: string | string[], qid?: string) => void;
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
      const sel = q.options.filter((_, i) => checked.has(i)).map(optionLabel);
      newAnswers[currentIdx] = sel;
    } else if (q.options) {
      newAnswers[currentIdx] = optionLabel(q.options[selected] || '(none)');
    } else {
      newAnswers[currentIdx] = textInput || '(skipped)';
    }
    setAnswers(newAnswers);
    if (isLast) {
      onSubmit(formatAnswers(questions, { answers: newAnswers, notes: {} }), newAnswers[currentIdx], q.qid);
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
            <Text style={{ color: t.accent,  fontSize: 12 }}>
              {currentIdx + 1} of {questions.length}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: t.muted,  fontSize: 12 }}>cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: t.fg,  fontSize: 14, marginBottom: 12, lineHeight: 20 }}>{q.text}</Text>

          <ScrollView style={{ maxHeight: 300, marginBottom: 12 }}>
            {q.options ? (
              q.options.map((opt, i) => {
                const isSelected = q.multi ? checked.has(i) : selected === i;
                return (
                  <TouchableOpacity key={i}
                    style={[s.option, { borderColor: isSelected ? t.accent : t.border }]}
                    onPress={() => toggleOption(i)}>
                    <Text style={{ color: isSelected ? t.accent : t.muted,  fontSize: 13, width: 20 }}>
                      {q.multi ? (isSelected ? '[x]' : '[ ]') : (isSelected ? ' ▸' : '  ')}
                    </Text>
                    <Text style={{ color: isSelected ? t.accent : t.fg,  fontSize: 13, flex: 1 }}>{optionLabel(opt)}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <TextInput
                style={{ color: t.fg,  fontSize: 13, borderWidth: 1, borderColor: t.border, backgroundColor: t.bgInput, padding: 10, minHeight: 60, textAlignVertical: 'top' }}
                placeholder="type your answer..."
                placeholderTextColor={t.muted}
                value={textInput} onChangeText={setTextInput}
                multiline autoFocus
              />
            )}
          </ScrollView>

          <TouchableOpacity style={[s.submitBtn, { borderColor: t.accent }]} onPress={submitCurrent}>
            <Text style={{ color: t.accent,  fontSize: 14 }}>
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
  sheet: { borderWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: Platform.OS === 'ios' ? 36 : 18, maxHeight: '80%' },
  option: { flexDirection: 'row', alignItems: 'center', padding: 13, borderWidth: 1, marginBottom: 8, borderRadius: 14 },
  submitBtn: { borderWidth: 1, padding: 13, alignItems: 'center', borderRadius: 999 },
});
