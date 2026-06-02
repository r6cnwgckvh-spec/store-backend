import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { logout, changePin, user } = useAuth();
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currency, setCurrency] = useState('\u20B9');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [gcpApiKey, setGcpApiKey] = useState('');
  const [hasGcpKey, setHasGcpKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChangePin, setShowChangePin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const styles = getStyles(colors);

  const Field = ({ label, value, onChange, placeholder, keyboardType, multiline }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 60 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
      />
    </View>
  );

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getSettings();
        setStoreName(s.store_name || '');
        setAddress(s.address || '');
        setPhone(s.phone || '');
        setEmail(s.email || '');
        setTaxId(s.tax_id || '');
        setCurrency(s.currency_symbol || '\u20B9');
        setCurrencyCode(s.currency_code || 'INR');
        setHasGcpKey(s.has_gcp_api_key || false);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    try {
      const result = await api.updateSettings({
        store_name: storeName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        tax_id: taxId.trim(),
        currency_symbol: currency.trim() || '\u20B9',
        currency_code: currencyCode.trim() || 'INR',
        gcp_api_key: gcpApiKey.trim(),
      });
      setHasGcpKey(result.has_gcp_api_key || false);
      Alert.alert('Saved', 'Settings updated!');
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handleChangePin = async () => {
    if (!oldPin || !newPin) { Alert.alert('Error', 'Fill in all fields'); return; }
    if (newPin.length < 4) { Alert.alert('Error', 'New PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin) { Alert.alert('Error', 'PINs do not match'); return; }
    setChangingPin(true);
    try {
      await changePin(oldPin, newPin);
      Alert.alert('Done', 'PIN changed successfully');
      setShowChangePin(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (e) { Alert.alert('Error', e.message); }
    setChangingPin(false);
  };

  if (loading) return <SafeAreaView style={styles.safe}><Text style={{ textAlign: 'center', marginTop: 40, color: colors.textLight }}>Loading...</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {user && (
          <View style={styles.userCard}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.userRole}>{user.role === 'admin' ? '👑 Admin' : '👤 User'}</Text>
          </View>
        )}

        <Field label="Store Name" value={storeName} onChange={setStoreName} placeholder="Your store name" />
        <Field label="Address" value={address} onChange={setAddress} placeholder="Store address" multiline />
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="Email address" keyboardType="email-address" />
        <Field label="Tax ID / GST" value={taxId} onChange={setTaxId} placeholder="Tax ID (optional)" />

        <Text style={styles.label}>Currency Symbol</Text>
        <View style={styles.currencyRow}>
          <TextInput style={[styles.input, { flex: 0, width: 60 }]} value={currency} onChangeText={setCurrency} placeholder="₹" placeholderTextColor={colors.placeholder} />
          <TextInput style={[styles.input, { flex: 1 }]} value={currencyCode} onChangeText={setCurrencyCode} placeholder="INR" placeholderTextColor={colors.placeholder} />
        </View>

        <Text style={[styles.label, { marginTop: 4 }]}>Google Cloud Vision API Key</Text>
        <Text style={{ fontSize: 11, color: colors.textLight, marginBottom: 8, marginLeft: 2 }}>
          {hasGcpKey ? '✅ Key configured' : 'Required for auto OCR bill scanning'}
        </Text>
        <TextInput style={styles.input} value={gcpApiKey} onChangeText={setGcpApiKey}
          placeholder="Paste your API key here" placeholderTextColor={colors.placeholder}
          autoCapitalize="none" autoCorrect={false} />

        <TouchableOpacity style={styles.btn} onPress={save}>
          <Text style={styles.btnText}>Save Settings</Text>
        </TouchableOpacity>

        {user?.role === 'admin' && (
          <TouchableOpacity style={styles.adminBtn} onPress={() => {
            Linking.openURL('https://store-backend-npao.onrender.com/admin/');
          }}>
            <Text style={styles.adminBtnText}>👑 Open Admin Panel</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>⏰ Server Keep-Alive</Text>
          <Text style={styles.infoText}>The app pings the server every 5 min to prevent cold starts. For 24/7 uptime, set up a free UptimeRobot monitor (https://uptimerobot.com) pinging /api/health every 5 min.</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.themeBtn, { backgroundColor: colors.primary }]} onPress={toggleTheme}>
          <Text style={styles.themeBtnText}>{isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.changePinBtn} onPress={() => setShowChangePin(true)}>
          <Text style={styles.changePinText}>🔑 Change PIN</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => {
          Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
          ]);
        }}>
          <Text style={styles.logoutText}>🚪 Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
        <Text style={styles.watermark}>Made by Kishan ❤️</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showChangePin} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Change PIN</Text>
            <TextInput style={styles.modalInput} placeholder="Current PIN" placeholderTextColor={colors.textSecondary}
              value={oldPin} onChangeText={setOldPin} keyboardType="number-pad" secureTextEntry maxLength={10} />
            <TextInput style={styles.modalInput} placeholder="New PIN" placeholderTextColor={colors.textSecondary}
              value={newPin} onChangeText={setNewPin} keyboardType="number-pad" secureTextEntry maxLength={10} />
            <TextInput style={styles.modalInput} placeholder="Confirm New PIN" placeholderTextColor={colors.textSecondary}
              value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" secureTextEntry maxLength={10} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.textMuted, flex: 1 }]}
                onPress={() => { setShowChangePin(false); setOldPin(''); setNewPin(''); setConfirmPin(''); }}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#6f42c1', flex: 1 }]}
                onPress={handleChangePin} disabled={changingPin}>
                <Text style={styles.modalBtnText}>{changingPin ? 'Changing...' : 'Change'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  content: { padding: 16 },
  userCard: { backgroundColor: colors.headerBg, borderRadius: 12, padding: 16, marginBottom: 20, alignItems: 'center' },
  userName: { fontSize: 18, fontWeight: '700', color: colors.headerText },
  userEmail: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  userRole: { fontSize: 13, color: colors.danger, marginTop: 4, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 8, padding: 12, fontSize: 15,
    borderWidth: 1, borderColor: colors.border, color: colors.textSecondary,
  },
  currencyRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btn: { backgroundColor: colors.success, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnText: { color: colors.headerText, fontSize: 16, fontWeight: '700' },
  adminBtn: { backgroundColor: colors.headerBg, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10 },
  adminBtnText: { color: colors.headerText, fontSize: 15, fontWeight: '700' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, marginVertical: 20 },
  themeBtn: { borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  themeBtnText: { color: colors.headerText, fontSize: 15, fontWeight: '700' },
  infoCard: { backgroundColor: colors.primary + '18', borderRadius: 10, padding: 14, marginBottom: 10 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  changePinBtn: { backgroundColor: '#6f42c1', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  changePinText: { color: colors.headerText, fontSize: 15, fontWeight: '700' },
  logoutBtn: { backgroundColor: colors.danger, borderRadius: 10, padding: 14, alignItems: 'center' },
  logoutText: { color: colors.headerText, fontSize: 15, fontWeight: '700' },
  watermark: { textAlign: 'center', fontSize: 12, color: colors.textLight, marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.card, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: colors.background, borderRadius: 10, padding: 14, fontSize: 16, color: colors.textSecondary, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  modalBtn: { borderRadius: 10, padding: 14, alignItems: 'center' },
  modalBtnText: { color: colors.headerText, fontSize: 15, fontWeight: '700' },
});
