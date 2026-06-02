import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';

export default function StoreSetupScreen({ onComplete }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    store_name: '',
    address: '',
    phone: '',
    email: '',
    tax_id: '',
  });

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.store_name.trim()) {
      Alert.alert('Required', 'Store name is required');
      return;
    }
    setLoading(true);
    try {
      await api.updateSettings({
        store_name: form.store_name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        tax_id: form.tax_id.trim(),
      });
      onComplete();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.icon}>{'\u{1F3EA}'}</Text>
          <Text style={styles.title}>Set Up Your Store</Text>
          <Text style={styles.subtitle}>Fill in your store details to get started</Text>

          <Text style={styles.label}>Store Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. My Store" placeholderTextColor={colors.placeholder}
            value={form.store_name} onChangeText={v => updateField('store_name', v)} editable={!loading} />

          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} placeholder="Store address" placeholderTextColor={colors.placeholder}
            value={form.address} onChangeText={v => updateField('address', v)} editable={!loading} multiline />

          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={colors.placeholder}
            value={form.phone} onChangeText={v => updateField('phone', v)} keyboardType="phone-pad" editable={!loading} />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="Store email" placeholderTextColor={colors.placeholder}
            value={form.email} onChangeText={v => updateField('email', v)} keyboardType="email-address" editable={!loading} />

          <Text style={styles.label}>Tax ID / GST</Text>
          <TextInput style={styles.input} placeholder="Tax ID or GST number" placeholderTextColor={colors.placeholder}
            value={form.tax_id} onChangeText={v => updateField('tax_id', v)} editable={!loading} />

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <TouchableOpacity style={styles.btn} onPress={handleSave}>
              <Text style={styles.btnText}>Save & Continue</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 48 },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.inputBg, borderRadius: 10, padding: 14, fontSize: 16, color: colors.text,
    marginBottom: 4, borderWidth: 1, borderColor: colors.border },
  btn: { backgroundColor: colors.primary, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
