import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import { sha256 } from '../utils/helpers';
import * as storage from '../services/storage';

export default function LockScreen({ onUnlock }) {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBioAvailable(compatible && enrolled);
    if (compatible && enrolled) {
      authenticateBiometric();
    }
  };

  const authenticateBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Store Manager',
        fallbackLabel: 'Enter PIN',
      });
      if (result.success) onUnlock();
    } catch {}
  };

  const handlePress = async (digit) => {
    if (pin.length >= 10) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length >= 4) {
      const storedHash = await storage.getPinHash();
      if (!storedHash) { onUnlock(); return; }
      const inputHash = await sha256(newPin);
      if (inputHash === storedHash) {
        setTimeout(() => onUnlock(), 200);
      } else {
        setError('Wrong PIN');
        setPin('');
      }
    }
  };

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Store Manager</Text>
        <Text style={styles.subtitle}>Enter PIN to unlock</Text>

        <View style={styles.dots}>
          {[0,1,2,3,4,5,6,7,8,9].map(i => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.pad}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <TouchableOpacity key={n} style={styles.key} onPress={() => handlePress(String(n))}>
              <Text style={styles.keyText}>{n}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity key="bio" style={styles.key} onPress={authenticateBiometric}>
            <Text style={styles.keyText}>{bioAvailable ? '\u{1F512}' : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity key={0} style={styles.key} onPress={() => handlePress('0')}>
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity key="bs" style={styles.key} onPress={handleBackspace}>
            <Text style={styles.keyText}>{'\u232B'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.headerBg },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '800', color: colors.headerText, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 30 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 300 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.textLight, margin: 4 },
  dotFilled: { backgroundColor: colors.primary },
  error: { color: colors.danger, fontSize: 14, marginBottom: 16 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280, gap: 12 },
  key: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  keyText: { fontSize: 28, color: colors.text, fontWeight: '600' },
});
