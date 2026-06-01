import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ onRegister, onLoginDone }) {
  const { loginWithPin, hasLocalPin, login, token } = useAuth();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) { onLoginDone?.(); return null; }

  const handlePinLogin = async () => {
    if (!pin) { Alert.alert('Error', 'Enter your PIN'); return; }
    setLoading(true);
    try {
      await loginWithPin(pin);
      onLoginDone?.();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const handleEmailLogin = async () => {
    if (!email || !pin) { Alert.alert('Error', 'Enter email and PIN'); return; }
    setLoading(true);
    try {
      await login(email, pin);
      onLoginDone?.();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  if (hasLocalPin) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>Store Manager</Text>
        <Text style={styles.subtitle}>Enter your PIN to continue</Text>
        <TextInput style={styles.input} placeholder="PIN" placeholderTextColor="#666" value={pin}
          onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={10} editable={!loading} />
        {loading ? <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 16 }} />
          : <TouchableOpacity style={styles.btn} onPress={handlePinLogin}><Text style={styles.btnText}>Unlock</Text></TouchableOpacity>}
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.logo}>🏪</Text>
      <Text style={styles.title}>Store Manager</Text>
      <Text style={styles.subtitle}>Login with your account</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#666" value={email}
        onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
      <TextInput style={styles.input} placeholder="PIN" placeholderTextColor="#666" value={pin}
        onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={10} editable={!loading} />
      {loading ? <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 16 }} />
        : <TouchableOpacity style={styles.btn} onPress={handleEmailLogin}><Text style={styles.btnText}>Login</Text></TouchableOpacity>}
      <TouchableOpacity style={styles.registerBtn} onPress={onRegister} disabled={loading}>
        <Text style={styles.registerText}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, fontSize: 16, color: '#fff',
    marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#e94560', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  registerBtn: { marginTop: 20, alignItems: 'center' },
  registerText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
});
