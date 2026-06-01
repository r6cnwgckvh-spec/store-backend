import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, SafeAreaView, Platform, Linking, Modal } from 'react-native';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const Field = ({ label, value, onChange, placeholder, keyboardType, multiline }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && { minHeight: 60 }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#999"
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
    />
  </View>
);

export default function SettingsScreen({ navigation }) {
  const { logout, changePin, user } = useAuth();
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currency, setCurrency] = useState('\u20B9');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [showChangePin, setShowChangePin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);

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
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    try {
      await api.updateSettings({
        store_name: storeName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        tax_id: taxId.trim(),
        currency_symbol: currency.trim() || '\u20B9',
        currency_code: currencyCode.trim() || 'INR',
      });
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

  if (loading) return <SafeAreaView style={styles.safe}><Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>Loading...</Text></SafeAreaView>;

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
          <TextInput style={[styles.input, { flex: 0, width: 60 }]} value={currency} onChangeText={setCurrency} placeholder="₹" />
          <TextInput style={[styles.input, { flex: 1 }]} value={currencyCode} onChangeText={setCurrencyCode} placeholder="INR" />
        </View>

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
            <TextInput style={styles.modalInput} placeholder="Current PIN" placeholderTextColor="#666"
              value={oldPin} onChangeText={setOldPin} keyboardType="number-pad" secureTextEntry maxLength={10} />
            <TextInput style={styles.modalInput} placeholder="New PIN" placeholderTextColor="#666"
              value={newPin} onChangeText={setNewPin} keyboardType="number-pad" secureTextEntry maxLength={10} />
            <TextInput style={styles.modalInput} placeholder="Confirm New PIN" placeholderTextColor="#666"
              value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" secureTextEntry maxLength={10} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#666', flex: 1 }]}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backBtn: { fontSize: 16, color: '#007bff', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  content: { padding: 16 },
  userCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 20, alignItems: 'center' },
  userName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  userEmail: { fontSize: 13, color: '#aaa', marginTop: 2 },
  userRole: { fontSize: 13, color: '#e94560', marginTop: 4, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#e0e0e0', color: '#333',
  },
  currencyRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btn: { backgroundColor: '#28a745', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  adminBtn: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10 },
  adminBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { borderTopWidth: 1, borderTopColor: '#e0e0e0', marginVertical: 20 },
  infoCard: { backgroundColor: '#e8f4fd', borderRadius: 10, padding: 14, marginBottom: 10 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#0056b3', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#444', lineHeight: 18 },
  changePinBtn: { backgroundColor: '#6f42c1', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  changePinText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  logoutBtn: { backgroundColor: '#dc3545', borderRadius: 10, padding: 14, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  watermark: { textAlign: 'center', fontSize: 12, color: '#999', marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 14, fontSize: 16, color: '#333', marginBottom: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  modalBtn: { borderRadius: 10, padding: 14, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
