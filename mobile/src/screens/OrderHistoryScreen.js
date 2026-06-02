import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

export default function OrderHistoryScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.getOrders({});
      setOrders(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadOrders);
    return unsub;
  }, [navigation, loadOrders]);

  const filtered = search.trim()
    ? orders.filter(o => {
        const s = search.toLowerCase();
        return (o.customer_name || '').toLowerCase().includes(s)
          || o.id.toString().includes(s)
          || (o.created_at || '').toLowerCase().includes(s)
          || (o.total_amount || 0).toString().includes(search);
      })
    : orders;

  const handleDelete = (order) => {
    Alert.alert(
      'Delete Order',
      `Delete order #${order.id}? Stock will be restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.deleteOrder(order.id); loadOrders(); }
          catch (e) { Alert.alert('Error', e.message); }
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.count}>{orders.length} total</Text>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search by customer, date, amount..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={filtered.length === 0 ? { flex: 1, justifyContent: 'center' } : { padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); }} />}
      >
        {loading ? (
          <Text style={styles.empty}>Loading...</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>{search ? 'No matching orders found' : 'No orders yet'}</Text>
        ) : (
          filtered.map(order => (
            <TouchableOpacity key={order.id} style={styles.card}
              onPress={() => navigation.navigate('OrderDetail', { id: order.id })}
              onLongPress={() => handleDelete(order)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Order #{order.id}</Text>
                <TouchableOpacity onPress={() => handleDelete(order)} style={styles.delBtn}>
                  <Text style={styles.delText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardBody}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customer}>{order.customer_name || 'Walk-in Customer'}</Text>
                  <Text style={styles.date}>{formatDate(order.created_at)}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.items}>{order.items_count} items</Text>
                  <Text style={styles.amount}>{formatCurrency(order.total_amount)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  count: { fontSize: 13, color: colors.textLight, fontWeight: '600' },
  searchRow: { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  clearBtn: { marginLeft: -40, padding: 8, zIndex: 1 },
  clearText: { fontSize: 16, color: colors.textLight, fontWeight: '600' },
  list: { flex: 1 },
  empty: { textAlign: 'center', color: colors.textLight, fontSize: 14 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderId: { fontSize: 15, fontWeight: '700', color: colors.text },
  delBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffe8e8', justifyContent: 'center', alignItems: 'center' },
  delText: { fontSize: 12, color: colors.danger, fontWeight: '700' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customer: { fontSize: 13, color: colors.textMuted },
  date: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  cardFooter: { alignItems: 'flex-end' },
  items: { fontSize: 11, color: colors.textLight },
  amount: { fontSize: 16, fontWeight: '700', color: colors.success, marginTop: 2 },
});
