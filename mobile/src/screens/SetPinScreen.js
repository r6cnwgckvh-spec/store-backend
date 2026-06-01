import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SetPinScreen({ setupToken }) {
  const { setPin } = useAuth();
  const [pin, setPinState] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetPin = async () => {
    if (pin.length < 4) { Alert.alert('Error', 'PIN must be at least 4 digits'); return; }
    if (pin !== confirm) { Alert.alert('Error', 'PINs do not match'); return; }
    setLoading(true);
    try {
      await setPin(pin, setupToken);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.logo}>🔑</Text>
      <Text style={styles.title}>Set Your PIN</Text>
      <Text style={styles.subtitle}>Choose a 4-10 digit PIN for quick login</Text>
      <TextInput style={styles.input} placeholder="New PIN" placeholderTextColor="#666" value={pin}
        onChangeText={setPinState} keyboardType="number-pad" secureTextEntry maxLength={10} editable={!loading} />
      <TextInput style={styles.input} placeholder="Confirm PIN" placeholderTextColor="#666" value={confirm}
        onChangeText={setConfirm} keyboardType="number-pad" secureTextEntry maxLength={10} editable={!loading} />
      {loading ? <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 16 }} />
        : <TouchableOpacity style={styles.btn} onPress={handleSetPin}><Text style={styles.btnText}>Set PIN & Enter</Text></TouchableOpacity>}
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
});
