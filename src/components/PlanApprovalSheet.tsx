import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal,
} from 'react-native';
import { parseFileSummary } from '../utils/plan';
import { useApp } from '../context/AppContext';

interface Props {
  planText: string;
  onExecute: () => void;
  onRevise: (feedback: string) => void;
  onCancel: () => void;
}

export default function PlanApprovalSheet({ planText, onExecute, onRevise, onCancel }: Props) {
  const { theme: t } = useApp();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  const summary = parseFileSummary(planText);
  const hasFiles = summary.creates.length > 0 || summary.modifies.length > 0;

  if (showFeedback) {
    return (
      <Modal transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: t.bgPanel }]}>
            <Text style={{ color: t.fg, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>Revision Feedback</Text>
            <TextInput
              style={[s.feedbackInput, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput }]}
              placeholder="What should be changed..."
              placeholderTextColor={t.muted}
              value={feedback} onChangeText={setFeedback}
              multiline autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: t.muted }]} onPress={() => setShowFeedback(false)}>
                <Text style={s.btnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: t.accent, flex: 2 }]}
                onPress={() => { if (feedback.trim()) onRevise(feedback.trim()); }}>
                <Text style={s.btnText}>Send Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="slide">
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: t.bgPanel }]}>
          <Text style={{ color: t.fg, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>Plan Ready</Text>

          {hasFiles && (
            <View style={[s.fileBox, { borderColor: t.border }]}>
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Files affected</Text>
              <ScrollView style={{ maxHeight: 150 }}>
                {summary.creates.map(f => (
                  <View key={f} style={s.fileRow}>
                    <Text style={{ color: t.success, fontSize: 12, fontWeight: '600', width: 55 }}>create</Text>
                    <Text style={{ color: t.fg, fontSize: 13, flex: 1 }} numberOfLines={1}>{f}</Text>
                  </View>
                ))}
                {summary.modifies.map(f => (
                  <View key={f} style={s.fileRow}>
                    <Text style={{ color: t.warning, fontSize: 12, fontWeight: '600', width: 55 }}>modify</Text>
                    <Text style={{ color: t.fg, fontSize: 13, flex: 1 }} numberOfLines={1}>{f}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity style={[s.btn, s.fullBtn, { backgroundColor: t.success }]} onPress={onExecute}>
            <Text style={s.btnText}>▶  Execute Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.fullBtn, { backgroundColor: t.accent }]} onPress={() => setShowFeedback(true)}>
            <Text style={s.btnText}>✎  Revise with Feedback</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.fullBtn, { backgroundColor: t.muted + '40' }]} onPress={onCancel}>
            <Text style={[s.btnText, { color: t.muted }]}>✕  Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  fileBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  fileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center', flex: 1 },
  fullBtn: { marginBottom: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  feedbackInput: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
});
