import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function PendingScreen({ email, onApproved, onRejected, onBack }) {
  const { checkStatus } = useAuth();
  const [message, setMessage] = useState('Waiting for admin approval...');
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const result = await checkStatus(email);
        if (result.status === 'approved') {
          clearInterval(intervalRef.current);
          onApproved(result.setupToken || null);
        } else if (result.status === 'rejected') {
          clearInterval(intervalRef.current);
          onRejected(result.message || 'Your registration was rejected.');
        }
      } catch {}
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [email]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>⏳</Text>
      <Text style={styles.title}>Registration Submitted</Text>
      <Text style={styles.subtitle}>{message}</Text>
      <ActivityIndicator size="large" color="#e94560" style={{ marginVertical: 24 }} />
      <Text style={styles.hint}>We'll notify you once the admin approves your account.{'\n\n'}
        Registered with: {email}</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => { clearInterval(intervalRef.current); onBack(); }}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', padding: 24 },
  logo: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 8 },
  hint: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  backBtn: { padding: 12 },
  backText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
});
