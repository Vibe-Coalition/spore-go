import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal,
} from 'react-native';
import { parseFileSummary } from '../utils/plan';
import { useTheme } from '../context/ThemeContext';

interface Props {
  planText: string;
  onExecute: () => void;
  onRevise: (feedback: string) => void;
  onCancel: () => void;
}

export default function PlanApprovalSheet({ planText, onExecute, onRevise, onCancel }: Props) {
  const { theme: t } = useTheme();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  const summary = parseFileSummary(planText);
  const hasFiles = summary.creates.length > 0 || summary.modifies.length > 0;

  if (showFeedback) {
    return (
      <Modal transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: t.bgPanel }]}>
            <Text style={[styles.title, { color: t.fg }]}>Revision Feedback</Text>
            <TextInput
              style={[styles.feedbackInput, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput }]}
              placeholder="What should be changed..."
              placeholderTextColor={t.muted}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              autoFocus
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: t.muted }]}
                onPress={() => setShowFeedback(false)}
              >
                <Text style={styles.btnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: t.accent, flex: 2, marginLeft: 8 }]}
                onPress={() => onRevise(feedback)}
              >
                <Text style={styles.btnText}>Send Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: t.bgPanel }]}>
          <Text style={[styles.title, { color: t.fg }]}>Plan Ready</Text>

          {hasFiles && (
            <View style={[styles.fileBox, { borderColor: t.border }]}>
              <Text style={[styles.fileHeader, { color: t.accent }]}>Files affected</Text>
              <ScrollView style={{ maxHeight: 150 }}>
                {summary.creates.map(f => (
                  <View key={f} style={styles.fileRow}>
                    <Text style={[styles.fileLabel, { color: t.success }]}>create</Text>
                    <Text style={[styles.fileName, { color: t.fg }]}>{f}</Text>
                  </View>
                ))}
                {summary.modifies.map(f => (
                  <View key={f} style={styles.fileRow}>
                    <Text style={[styles.fileLabel, { color: t.warning }]}>modify</Text>
                    <Text style={[styles.fileName, { color: t.fg }]}>{f}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.fullBtn, { backgroundColor: t.success }]}
            onPress={onExecute}
          >
            <Text style={styles.btnText}>▶  Execute Plan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.fullBtn, { backgroundColor: t.accent }]}
            onPress={() => setShowFeedback(true)}
          >
            <Text style={styles.btnText}>✎  Revise with Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.fullBtn, { backgroundColor: t.muted + '40' }]}
            onPress={onCancel}
          >
            <Text style={[styles.btnText, { color: t.muted }]}>✕  Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  fileBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  fileHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fileLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 55,
  },
  fileName: {
    fontSize: 13,
    fontFamily: 'monospace',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  btn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    flex: 1,
  },
  fullBtn: {
    marginBottom: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
});
