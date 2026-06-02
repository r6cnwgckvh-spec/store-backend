import React, { useEffect, useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { formatCurrency, formatDate, stockStatus } from '../utils/helpers';
import { SidebarContext } from '../context/SidebarContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { openSidebar } = useContext(SidebarContext);
  const [stats, setStats] = useState({ products: 0, lowStock: 0, outOfStock: 0 });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const styles = getStyles(colors);

  const StatCard = ({ label, value, color }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const loadData = useCallback(async () => {
    try {
      const [products, lowStock, orders] = await Promise.all([
        api.getProducts({}), api.getLowStock(10), api.getOrders({ limit: 5 }),
      ]);
      setLowStockItems(lowStock);
      setRecentOrders(orders);
      setStats({
        products: products.length,
        lowStock: products.filter(p => p.stock > 0 && p.stock <= 5).length,
        outOfStock: products.filter(p => p.stock <= 0).length,
      });
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation, loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={openSidebar} style={styles.menuBtn}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsRow}>
          <StatCard label="Products" value={stats.products} color={colors.primary} />
          <StatCard label="Low Stock" value={stats.lowStock} color={colors.warning} />
          <StatCard label="Out of Stock" value={stats.outOfStock} color={colors.danger} />
        </View>

        <View style={styles.quickActions}>
          {[
            { icon: '📷', label: 'Scan & Add', onPress: () => navigation.navigate('Scanner', { mode: 'add' }) },
            { icon: '🛒', label: 'Scan & Sell', onPress: () => navigation.navigate('Scanner', { mode: 'sell' }) },
            { icon: '📦', label: 'Inventory', onPress: () => navigation.navigate('Products') },
            { icon: '📊', label: 'Reports', onPress: () => navigation.navigate('Reports') },
            { icon: '🏷️', label: 'Categories', onPress: () => navigation.navigate('Categories') },
            { icon: '⚙️', label: 'Settings', onPress: () => navigation.navigate('Settings') },
          ].map(({ icon, label, onPress }) => (
            <TouchableOpacity key={label} style={styles.actionBtn} onPress={onPress}>
              <Text style={styles.actionIcon}>{icon}</Text>
              <Text style={styles.actionText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {lowStockItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>⬇ Low Stock Alerts</Text>
            {lowStockItems.map(item => (
              <TouchableOpacity key={item.id} style={styles.alertItem}
                onPress={() => navigation.navigate('Products', { screen: 'ProductDetail', params: { id: item.id } })}>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertName}>{item.name}</Text>
                  <Text style={styles.alertBarcode}>{item.barcode}</Text>
                </View>
                <View style={[styles.stockBadge, { backgroundColor: stockStatus(item.stock).color + '20' }]}>
                  <Text style={[styles.stockText, { color: stockStatus(item.stock).color }]}>{item.stock} left</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Recent Orders</Text>
        {recentOrders.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet</Text>
        ) : (
          recentOrders.map(order => (
            <TouchableOpacity key={order.id} style={styles.orderItem}
              onPress={() => navigation.navigate('Orders', { screen: 'OrderDetail', params: { id: order.id } })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderId}>Order #{order.id}</Text>
                <Text style={styles.orderCustomer}>{order.customer_name || 'Walk-in Customer'}</Text>
                <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>{formatCurrency(order.total_amount)}</Text>
                <Text style={styles.orderItems}>{order.items_count} items</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <Text style={styles.watermark}>Made by Kishan ❤️</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  content: { padding: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  menuBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { fontSize: 24, color: colors.text },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  statCard: { flex: 1, backgroundColor: colors.statsCard, borderRadius: 12, padding: 12, borderLeftWidth: 4, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 8 },
  actionBtn: { width: (width - 48 - 8) / 2, backgroundColor: colors.card, borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2 },
  actionIcon: { fontSize: 26, marginBottom: 6 },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 12, color: colors.text, marginTop: 8 },
  alertItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1,
  },
  alertInfo: { flex: 1 },
  alertName: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  alertBarcode: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  stockBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  stockText: { fontSize: 13, fontWeight: '700' },
  emptyText: { color: colors.textLight, fontSize: 14, marginVertical: 20, textAlign: 'center' },
  orderItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1,
  },
  orderId: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  orderCustomer: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  orderDate: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  orderRight: { alignItems: 'flex-end' },
  orderAmount: { fontSize: 15, fontWeight: '700', color: colors.success },
  orderItems: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  watermark: { textAlign: 'center', fontSize: 12, color: colors.watermark, marginTop: 10 },
});
