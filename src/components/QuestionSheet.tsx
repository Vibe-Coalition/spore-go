import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal,
} from 'react-native';
import { Question, AnswersData, formatAnswers } from '../utils/questions';
import { useTheme } from '../context/ThemeContext';

interface Props {
  questions: Question[];
  onSubmit: (formatted: string) => void;
  onCancel: () => void;
}

export default function QuestionSheet({ questions, onSubmit, onCancel }: Props) {
  const { theme: t } = useTheme();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [textInput, setTextInput] = useState('');
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const q = questions[currentIdx];
  if (!q) return null;

  const isLast = currentIdx === questions.length - 1;

  const submitCurrent = () => {
    const newAnswers = { ...answers };

    if (q.options && q.multi) {
      const selected = q.options.filter((_, i) => checked.has(i));
      newAnswers[currentIdx] = selected.length ? selected : ['(none)'];
    } else if (q.options) {
      newAnswers[currentIdx] = q.options[checked.values().next().value ?? 0] || '(none)';
    } else {
      newAnswers[currentIdx] = textInput || '(skipped)';
    }

    setAnswers(newAnswers);

    if (isLast) {
      const data: AnswersData = { answers: newAnswers, notes: {} };
      onSubmit(formatAnswers(questions, data));
    } else {
      setCurrentIdx(currentIdx + 1);
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
      setChecked(new Set([idx]));
    }
  };

  const styles = makeStyles(t);

  return (
    <Modal transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: t.bgPanel }]}>
          <View style={styles.header}>
            <Text style={[styles.counter, { color: t.accent }]}>
              Question {currentIdx + 1}/{questions.length}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <Text style={[styles.cancelText, { color: t.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.questionText, { color: t.fg }]}>{q.text}</Text>

          <ScrollView style={styles.optionsContainer}>
            {q.options ? (
              q.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.option,
                    { borderColor: t.border },
                    checked.has(i) && { borderColor: t.accent, backgroundColor: t.accent + '15' },
                  ]}
                  onPress={() => toggleOption(i)}
                >
                  <View style={[
                    styles.radio,
                    { borderColor: checked.has(i) ? t.accent : t.muted },
                    checked.has(i) && { backgroundColor: t.accent },
                  ]}>
                    {q.multi && checked.has(i) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={[styles.optionText, { color: t.fg }]}>{opt}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <TextInput
                style={[styles.textInput, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput }]}
                placeholder="Type your answer..."
                placeholderTextColor={t.muted}
                value={textInput}
                onChangeText={setTextInput}
                multiline
                autoFocus
              />
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: t.accent }]}
            onPress={submitCurrent}
          >
            <Text style={styles.submitText}>
              {isLast ? 'Submit' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  counter: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cancelText: { fontSize: 14 },
  questionText: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 24,
  },
  optionsContainer: {
    marginBottom: 16,
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  optionText: { fontSize: 15, flex: 1, lineHeight: 20 },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
