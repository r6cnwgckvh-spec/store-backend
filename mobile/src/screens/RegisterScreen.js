import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ onBack, onPending, onSetPin }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim()) { Alert.alert('Error', 'Name and email are required'); return; }
    if (!email.includes('@')) { Alert.alert('Error', 'Enter a valid email address'); return; }
    setLoading(true);
    try {
      const result = await register(name.trim(), email.trim().toLowerCase());
      if (result.user?.status === 'approved') {
        Alert.alert('Welcome!', result.message || 'You are approved! Set your PIN.');
        onSetPin();
      } else {
        Alert.alert('Registered!', result.message || 'Wait for admin approval.');
        onPending(email.trim().toLowerCase());
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.logo}>📝</Text>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Register to use the store app</Text>
      <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#666" value={name}
        onChangeText={setName} autoCapitalize="words" editable={!loading} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#666" value={email}
        onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
      <Text style={styles.hint}>After admin approves, you'll set your PIN to login.</Text>
      {loading ? <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 16 }} />
        : <TouchableOpacity style={styles.btn} onPress={handleRegister}><Text style={styles.btnText}>Register</Text></TouchableOpacity>}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} disabled={loading}>
        <Text style={styles.backText}>← Back to Login</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 24 },
  hint: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, fontSize: 16, color: '#fff',
    marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#e94560', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { marginTop: 16, alignItems: 'center' },
  backText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
});
