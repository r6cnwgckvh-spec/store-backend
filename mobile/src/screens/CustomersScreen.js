import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';

export default function CustomersScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { try { setCustomers(await api.getCustomers({ search })); } catch (e) {} }, [search]);
  useEffect(() => { const u = navigation.addListener('focus', load); return u; }, [navigation, load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleDelete = (c) => {
    Alert.alert('Delete', `Delete ${c.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteCustomer(c.id); load(); }},
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CustomerDetail', { id: item.id })}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => handleDelete(item)}><Text style={{ fontSize: 18 }}>🗑️</Text></TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TextInput style={styles.search} placeholder="Search customers..." value={search} onChangeText={setSearch} />
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CustomerForm')}><Text style={styles.addBtnText}>+</Text></TouchableOpacity>
      </View>
      <FlatList data={customers} renderItem={renderItem} keyExtractor={i => i.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={customers.length === 0 ? { flex: 1, justifyContent: 'center', alignItems: 'center' } : { paddingBottom: 20 }}
        ListEmptyComponent={<View style={{ alignItems: 'center' }}><Text style={{ fontSize: 60 }}>👥</Text><Text style={{ color: '#999', marginTop: 12 }}>No customers yet</Text></View>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  search: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, elevation: 2 },
  addBtn: { marginLeft: 10, width: 48, height: 48, borderRadius: 24, backgroundColor: '#007bff', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  addBtnText: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: -2 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, elevation: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007bff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  name: { fontSize: 15, fontWeight: '600', color: '#333' },
  phone: { fontSize: 13, color: '#666', marginTop: 2 },
});