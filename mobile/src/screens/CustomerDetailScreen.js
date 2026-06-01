import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { api } from '../api';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function CustomerDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [c, o] = await Promise.all([api.getCustomer(id), api.getCustomerOrders(id)]);
      setCustomer(c); setOrders(o);
      setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address });
    } catch (e) { Alert.alert('Error', 'Not found'); navigation.goBack(); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Name required');
    try { await api.updateCustomer(id, form); setEditing(false); loadData(); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  if (!customer) return null;
  const totalSpent = orders.reduce((s, o) => s + o.total_amount, 0);

  if (editing) return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>Edit Customer</Text>
      <TextInput style={styles.input} placeholder="Name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} />
      <TextInput style={styles.input} placeholder="Phone" value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Email" value={form.email} onChangeText={t => setForm(f => ({ ...f, email: t }))} keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Address" value={form.address} onChangeText={t => setForm(f => ({ ...f, address: t }))} multiline />
      <TouchableOpacity style={[styles.btn, { backgroundColor: '#28a745' }]} onPress={handleSave}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
      <TouchableOpacity style={{ padding: 14, alignItems: 'center' }} onPress={() => setEditing(false)}><Text style={{ color: '#666' }}>Cancel</Text></TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
    <ScrollView style={styles.container}>
      <View style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.name}>{customer.name}</Text>
        {customer.phone ? <Text style={styles.detail}>{customer.phone}</Text> : null}
        {customer.email ? <Text style={styles.detail}>{customer.email}</Text> : null}
        {customer.address ? <Text style={styles.detail}>{customer.address}</Text> : null}
        <Text style={{ fontSize: 11, color: '#999', marginTop: 8 }}>Since {formatDate(customer.created_at)}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{orders.length}</Text><Text style={styles.statLabel}>Orders</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{formatCurrency(totalSpent)}</Text><Text style={styles.statLabel}>Total</Text></View>
      </View>

      <TouchableOpacity style={[styles.btn, { backgroundColor: '#007bff', marginBottom: 16 }]} onPress={() => setEditing(true)}>
        <Text style={styles.btnText}>Edit Details</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#1a1a2e' }}>Order History</Text>
      {orders.length === 0 ? <Text style={{ textAlign: 'center', color: '#999', marginVertical: 20 }}>No orders yet</Text> : (
        orders.map(order => (
          <TouchableOpacity key={order.id} style={styles.orderItem}
            onPress={() => navigation.navigate('Orders', { screen: 'OrderDetail', params: { id: order.id } })}>
            <View>
              <Text style={{ fontWeight: '600' }}>Order #{order.id}</Text>
              <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{formatDate(order.created_at)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#28a745' }}>{formatCurrency(order.total_amount)}</Text>
              <Text style={{ fontSize: 11, color: '#999' }}>{order.items_count} items</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  profile: { alignItems: 'center', padding: 20, backgroundColor: '#fff', marginBottom: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#007bff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  detail: { fontSize: 14, color: '#666', marginBottom: 2 },
  statsRow: { flexDirection: 'row', marginBottom: 16, paddingHorizontal: 16 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 4, alignItems: 'center', elevation: 2 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center', marginHorizontal: 16 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 14, elevation: 1 },
});
