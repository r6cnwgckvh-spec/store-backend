import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, SafeAreaView, Platform } from 'react-native';
import { api } from '../api';

export default function CustomerFormScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    setLoading(true);
    try {
      await api.createCustomer({ name: name.trim(), phone, email, address });
      Alert.alert('Success', 'Customer added');
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add Customer</Text>
        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Customer name" />
        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
        <Text style={styles.label}>Address</Text>
        <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} placeholder="Address" multiline />
        <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Saving...' : 'Add Customer'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#1a1a2e' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginLeft: 2 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 16 },
  btn: { backgroundColor: '#007bff', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, elevation: 3 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});