import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { formatCurrency, formatDate, stockStatus, getImageUrl } from '../utils/helpers';

export default function ProductDetailScreen({ route, navigation }) {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
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
        <Row label="Selling Price" value={product.tablets_per_strip > 1 ? `${formatCurrency(product.price)}/strip` : formatCurrency(product.price)} color="#28a745" />
        <Row label="Cost Price" value={product.tablets_per_strip > 1 ? `${formatCurrency(product.cost_price || 0)}/strip` : formatCurrency(product.cost_price || 0)} color="#dc3545" />
        <Row label={product.tablets_per_strip > 1 ? "Profit/Strip" : "Profit"} value={formatCurrency(product.price - (product.cost_price || 0))} color="#007bff" />
        {product.tablets_per_strip > 1 && (
          <>
            <Row label="Pack Size" value={`${product.tablets_per_strip} tablets/strip`} />
            <Row label="Per Tablet" value={formatCurrency(product.price / product.tablets_per_strip)} color="#e83e8c" />
          </>
        )}
        <Row label="Stock" value={product.tablets_per_strip > 1
          ? `${Math.floor(product.stock / product.tablets_per_strip)} strips + ${product.stock % product.tablets_per_strip} tablets`
          : `${product.stock} units`} />
        <Row label="Category" value={product.category || '\u2014'} />
        <Row label="Size" value={product.size || '\u2014'} />
        <Row label="Description" value={product.description || '\u2014'} />
        <Row label="Added" value={formatDate(product.created_at)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#007bff' }]}
          onPress={() => navigation.navigate('AddProduct', { product })}>
          <Text style={styles.btnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#dc3545' }]}
          onPress={handleDelete}>
          <Text style={styles.btnText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.btn, { backgroundColor: '#28a745' }]}
        onPress={() => navigation.navigate('Cart', { screen: 'CartMain', params: { scannedProduct: product } })}>
        <Text style={styles.btnText}>🛒 Add to Cart & Sell</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
     </SafeAreaView>
  );
}

const Row = ({ label, value, color }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, color && { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 16 },
  productImage: { width: 120, height: 120, borderRadius: 16, marginBottom: 12, backgroundColor: '#f0f0f0' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e' },
  barcode: { fontSize: 14, color: '#999', marginTop: 4 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  statusText: { fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1, textAlign: 'right', marginLeft: 16 },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center', elevation: 2 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
