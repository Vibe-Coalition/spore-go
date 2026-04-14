import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal, Platform,
} from 'react-native';
import { parseFileSummary } from '../utils/plan';
import { useApp, MONO_FONT as MONO } from '../context/AppContext';

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
          <View style={[s.sheet, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
            <Text style={{ color: t.fg, fontFamily: MONO, fontSize: 14, marginBottom: 12 }}>
              ┌─ revision feedback {'─'.repeat(14)}┐
            </Text>
            <TextInput
              style={{ color: t.fg, fontFamily: MONO, fontSize: 13, borderWidth: 1, borderColor: t.border, backgroundColor: t.bgInput, padding: 10, minHeight: 80, textAlignVertical: 'top' }}
              placeholder="What should be changed..."
              placeholderTextColor={t.muted}
              value={feedback} onChangeText={setFeedback}
              multiline autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[s.btn, { borderColor: t.muted }]} onPress={() => setShowFeedback(false)}>
                <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 13 }}>[back]</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { borderColor: t.accent, flex: 2 }]}
                onPress={() => { if (feedback.trim()) onRevise(feedback.trim()); }}>
                <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 13 }}>[send feedback]</Text>
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
        <View style={[s.sheet, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
          <Text style={{ color: t.fg, fontFamily: MONO, fontSize: 14, marginBottom: 12 }}>
            ┌─ plan ready {'─'.repeat(20)}┐
          </Text>

          {hasFiles && (
            <View style={{ borderWidth: 1, borderColor: t.border, padding: 10, marginBottom: 12 }}>
              <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 11, marginBottom: 6 }}>files affected:</Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {summary.creates.map(f => (
                  <Text key={f} style={{ color: t.success, fontFamily: MONO, fontSize: 12 }}>  + {f}</Text>
                ))}
                {summary.modifies.map(f => (
                  <Text key={f} style={{ color: t.warning, fontFamily: MONO, fontSize: 12 }}>  ~ {f}</Text>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity style={[s.btn, { borderColor: t.success }]} onPress={onExecute}>
            <Text style={{ color: t.success, fontFamily: MONO, fontSize: 14 }}>  ▶ [execute plan]</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { borderColor: t.accent }]} onPress={() => setShowFeedback(true)}>
            <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 14 }}>  ✎ [revise with feedback]</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { borderColor: t.muted }]} onPress={onCancel}>
            <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 14 }}>  ✕ [cancel]</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 16 },
  btn: { borderWidth: 1, padding: 12, marginBottom: 8 },
});
