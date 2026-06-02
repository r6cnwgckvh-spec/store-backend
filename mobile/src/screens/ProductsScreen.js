import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { api } from '../api';
import { formatCurrency, stockStatus, getImageUrl } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

const CACHE_FILE = FileSystem.documentDirectory + 'products_cache.json';

export default function ProductsScreen({ navigation }) {
  const { colors } = useTheme();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const styles = getStyles(colors);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.getProducts({}), api.getCategories()]);
      setProducts(p);
      setCategories(c);
      setOffline(false);
      await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify({ products: p, categories: c }));
    } catch (e) {
      console.error(e);
      const cached = await FileSystem.readAsStringAsync(CACHE_FILE).catch(() => null);
      if (cached) {
        const { products: cp, categories: cc } = JSON.parse(cached);
        setProducts(cp); setCategories(cc || []); setOffline(true);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const filtered = products.filter(p => {
    const m = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search);
    const c = !catFilter || (p.category || '').toLowerCase() === catFilter.toLowerCase();
    return m && c;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Products</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddProduct')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.search}
        placeholder="Search by name or barcode..."
        placeholderTextColor={colors.placeholder}
        value={search}
        onChangeText={setSearch}
      />
      {categories.length > 0 && (
        <View style={styles.catRow}>
          <TouchableOpacity style={[styles.catChip, !catFilter && styles.catActive]} onPress={() => setCatFilter('')}>
            <Text style={[styles.catText, !catFilter && styles.catTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.catChip, catFilter === c.name && styles.catActive, { borderColor: c.color }]}
              onPress={() => setCatFilter(catFilter === c.name ? '' : c.name)}
            >
              <View style={[styles.catDot, { backgroundColor: c.color }]} />
              <Text style={[styles.catText, catFilter === c.name && styles.catTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {offline ? <View style={{ backgroundColor: colors.warning, padding: 6 }}><Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>📡 Offline — showing cached data</Text></View> : null}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={filtered.length === 0 ? { flex: 1, justifyContent: 'center' } : { padding: 16, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={styles.empty}>{search || catFilter ? 'No matching products' : 'No products yet. Tap + to add!'}</Text>}
        renderItem={({ item }) => {
          const ss = stockStatus(item.stock);
          return (
            <TouchableOpacity style={styles.card}
              onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
            >
              <View style={styles.cardLeft}>
                {item.image_url ? (
                  <Image source={{ uri: getImageUrl(item.image_url) }} style={styles.thumb} />
                ) : (
                  <View style={[styles.stockIndicator, { backgroundColor: ss.color }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.barcode}>{item.barcode}</Text>
                  {item.category ? <Text style={styles.category}>{item.category}</Text> : null}
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.price}>{formatCurrency(item.price)}</Text>
                <View style={[styles.stockBadge, { backgroundColor: ss.color + '20' }]}>
                  <Text style={[styles.stockText, { color: ss.color }]}>{item.tablets_per_strip > 1 ? `${Math.floor(item.stock / item.tablets_per_strip)}s+${item.stock % item.tablets_per_strip}t` : item.stock} {ss.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  addBtn: { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 8 },
  addBtnText: { color: colors.headerText, fontSize: 14, fontWeight: '700' },
  search: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.inputBg, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 8, gap: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  catActive: { backgroundColor: colors.headerBg, borderColor: colors.headerBg },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  catText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  catTextActive: { color: colors.headerText },
  empty: { textAlign: 'center', color: colors.textLight, fontSize: 14, marginTop: 40 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, elevation: 2 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stockIndicator: { width: 4, height: 40, borderRadius: 2 },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.border },
  name: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  barcode: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  category: { fontSize: 11, color: colors.primary, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', marginLeft: 10 },
  price: { fontSize: 16, fontWeight: '700', color: colors.success },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  stockText: { fontSize: 10, fontWeight: '700' },
});
