import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { formatCurrency, formatDate, stockStatus, getImageUrl } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

export default function ProductDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { id, barcode } = route.params || {};
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProduct(); }, []);

  const loadProduct = async () => {
    try {
      const data = id ? await api.getProduct(id) : await api.getProductByBarcode(barcode);
      setProduct(data);
    } catch (e) { Alert.alert('Error', 'Product not found'); navigation.goBack(); }
    finally { setLoading(false); }
  };

  const handleDelete = () => {
    Alert.alert('Delete', `Delete ${product.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteProduct(product.id); navigation.goBack(); }},
    ]);
  };

  if (loading) return <View style={styles.center}><Text>Loading...</Text></View>;
  if (!product) return null;

  const st = stockStatus(product.stock);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {product.image_url ? (
          <Image source={{ uri: getImageUrl(product.image_url) }} style={styles.productImage} />
        ) : null}
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.barcode}>{product.barcode}</Text>
        <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Row label="Selling Price" value={product.tablets_per_strip > 1 ? `${formatCurrency(product.price)}/strip` : formatCurrency(product.price)} color={colors.success} styles={styles} />
        <Row label="Cost Price" value={product.tablets_per_strip > 1 ? `${formatCurrency(product.cost_price || 0)}/strip` : formatCurrency(product.cost_price || 0)} color={colors.danger} styles={styles} />
        <Row label={product.tablets_per_strip > 1 ? "Profit/Strip" : "Profit"} value={formatCurrency(product.price - (product.cost_price || 0))} color={colors.primary} styles={styles} />
        {product.tablets_per_strip > 1 && (
          <>
            <Row label="Pack Size" value={`${product.tablets_per_strip} tablets/strip`} styles={styles} />
            <Row label="Per Tablet" value={formatCurrency(product.price / product.tablets_per_strip)} color="#e83e8c" styles={styles} />
          </>
        )}
        <Row label="Stock" value={product.tablets_per_strip > 1
          ? `${Math.floor(product.stock / product.tablets_per_strip)} strips + ${product.stock % product.tablets_per_strip} tablets`
          : `${product.stock} units`} styles={styles} />
        <Row label="Category" value={product.category || '\u2014'} styles={styles} />
        <Row label="Size" value={product.size || '\u2014'} styles={styles} />
        <Row label="Description" value={product.description || '\u2014'} styles={styles} />
        <Row label="Added" value={formatDate(product.created_at)} styles={styles} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AddProduct', { product })}>
          <Text style={styles.btnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: colors.danger }]}
          onPress={handleDelete}>
          <Text style={styles.btnText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success }]}
        onPress={() => navigation.navigate('Cart', { screen: 'CartMain', params: { scannedProduct: product } })}>
        <Text style={styles.btnText}>🛒 Add to Cart & Sell</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
     </SafeAreaView>
  );
}

const Row = ({ label, value, color, styles }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, color && { color }]}>{value}</Text>
  </View>
);

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 16 },
  productImage: { width: 120, height: 120, borderRadius: 16, marginBottom: 12, backgroundColor: colors.background },
  name: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  barcode: { fontSize: 14, color: colors.textLight, marginTop: 4 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  statusText: { fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.background },
  label: { fontSize: 14, color: colors.textMuted },
  value: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, flex: 1, textAlign: 'right', marginLeft: 16 },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center', elevation: 2 },
  btnText: { color: colors.headerText, fontSize: 15, fontWeight: '700' },
});
