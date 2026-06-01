import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { formatCurrency } from '../utils/helpers';

const paymentMethods = ['Cash', 'UPI', 'Card', 'Credit'];

export default function CartScreen({ route, navigation }) {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ id: null, name: '', phone: '' });
  const [showCustomer, setShowCustomer] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percent'
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showFav, setShowFav] = useState(false);
  const [favProducts, setFavProducts] = useState([]);
  const [searchProd, setSearchProd] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [printBill, setPrintBill] = useState(true);
  const searchTimer = useRef(null);

  const addToCart = useCallback(async (barcode, productData) => {
    try {
      const product = productData || (barcode ? await api.getProductByBarcode(barcode) : null);
      if (!product) return;
      setCart(prev => {
        const ex = prev.find(i => i.id === product.id);
        return ex ? prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
          : [...prev, { ...product, quantity: 1 }];
      });
    } catch (e) {
      Alert.alert('Not Found', 'Barcode not in inventory. Add it first?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Product', onPress: () => navigation.navigate('Products', { screen: 'AddProduct', params: { barcode } }) },
      ]);
    }
  }, []);

  useEffect(() => {
    if (route.params?.scannedBarcode) { addToCart(route.params.scannedBarcode, null); navigation.setParams({ scannedBarcode: undefined }); }
    if (route.params?.scannedProduct) { addToCart(null, route.params.scannedProduct); navigation.setParams({ scannedProduct: undefined }); }
    loadFavorites();
  }, [route.params?.scannedBarcode, route.params?.scannedProduct]);

  const loadFavorites = async () => {
    try {
      const orders = await api.getOrders({ limit: 200 });
      const counts = {};
      for (const o of orders.slice(0, 20)) {
        try { const d = await api.getOrder(o.id); for (const item of d.items) { counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity; } } catch (e) {}
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const favs = [];
      for (const [id] of sorted) {
        try { const p = await api.getProduct(parseInt(id)); if (p) favs.push(p); } catch (e) {}
      }
      setFavProducts(favs);
    } catch (e) {}
  };

  const searchProducts = async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const res = await api.getProducts({ search: q });
      setSearchResults(res.filter(p => !cart.find(c => c.id === p.id)).slice(0, 8));
    } catch (e) { setSearchResults([]); }
  };

  const handleSearchChange = (q) => {
    setSearchProd(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchProducts(q), 300);
  };

  const updateQty = (id, d) => setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + d) } : i).filter(i => i.quantity > 0));
  const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const toUnitPrice = (item) => item.price / (item.tablets_per_strip || 1);
  const subtotal = cart.reduce((s, i) => s + toUnitPrice(i) * i.quantity, 0);
  const discVal = parseFloat(discount) || 0;
  const discAmount = discountType === 'percent' ? subtotal * discVal / 100 : discVal;
  const total = Math.max(0, subtotal - discAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) return Alert.alert('Cart Empty', 'Scan products to add');
    doCheckout();
  };

  const doCheckout = async () => {
    setSubmitting(true);
    try {
      let cId = customer.id;
      if (customer.name && !customer.id) {
        const nc = await api.createCustomer({ name: customer.name, phone: customer.phone });
        cId = nc.id;
      }
      const order = await api.createOrder({
        customer_id: cId,
        customer_name: customer.name || 'Walk-in Customer',
        customer_phone: customer.phone || '',
        discount: discAmount,
        payment_method: paymentMethod,
        items: cart.map(i => ({ product_id: i.id, quantity: i.quantity })),
      });
      const orderFull = await api.getOrder(order.id);
      setCart([]);
      setCustomer({ id: null, name: '', phone: '' });
      setDiscount('0');
      navigation.navigate('Orders', { screen: 'OrderDetail', params: { order: orderFull, printPdf: printBill } });
    } catch (e) {
      let msg = e.message;
      try { const j = JSON.parse(e.message); msg = j.error || msg; } catch {}
      Alert.alert('Error', msg);
    } finally { setSubmitting(false); }
  };

  const loadCustomers = async () => { try { setCustomers(await api.getCustomers({})); } catch (e) {} };

  const renderItem = ({ item }) => {
    const tps = item.tablets_per_strip || 1;
    const unitPrice = item.price / tps;
    const isStrip = tps > 1;
    return (
    <View style={styles.item}>
      <TouchableOpacity style={styles.itemDel} onPress={() => removeItem(item.id)}>
        <Text style={{ color: '#dc3545', fontSize: 10, fontWeight: '700' }}>✕</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemPrice}>
          {isStrip ? `${formatCurrency(unitPrice)}/tablet` : formatCurrency(item.price)}
        </Text>
      </View>
      <View style={styles.qty}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.itemTotal}>{formatCurrency(unitPrice * item.quantity)}</Text>
    </View>
  );};

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Cart & Billing</Text>
        <Text style={styles.topCount}>{cart.length} items</Text>
      </View>
      <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('Scanner', { mode: 'sell' })}>
        <Text style={styles.scanBtnText}>📷 Scan Product to Add</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowSearch(!showSearch)} style={styles.searchToggle}>
        <Text style={styles.searchToggleText}>🔍 Search Product by Name {showSearch ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {showSearch && (
        <View style={styles.searchBox}>
          <TextInput style={styles.searchInput} placeholder="Type product name..." value={searchProd} onChangeText={handleSearchChange} />
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map(p => (
                <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => { addToCart(null, p); setSearchProd(''); setSearchResults([]); setShowSearch(false); }}>
                  <Text style={styles.searchResultName}>{p.name}</Text>
                  <Text style={styles.searchResultPrice}>{formatCurrency(p.price)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {favProducts.length > 0 && (
        <>
          <TouchableOpacity onPress={() => setShowFav(!showFav)} style={styles.favToggle}>
            <Text style={styles.favToggleText}>⭐ Quick Add ({favProducts.length}) {showFav ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showFav && (
            <View style={styles.favGrid}>
              {favProducts.map(p => (
                <TouchableOpacity key={p.id} style={styles.favItem} onPress={() => addToCart(null, p)}>
                  <Text style={styles.favIcon}>📦</Text>
                  <Text style={styles.favName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.favPrice}>{formatCurrency(p.price)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      <TouchableOpacity style={styles.custBtn} onPress={() => { loadCustomers(); setShowCustomer(!showCustomer); }}>
        <Text style={{ color: customer.name ? '#333' : '#999', fontWeight: customer.name ? '600' : '400' }}>
          👤 {customer.name || 'Add Customer (Optional)'}
        </Text>
      </TouchableOpacity>
      {showCustomer && (
        <View style={styles.custForm}>
          <TextInput style={styles.input} placeholder="Customer name" value={customer.name} onChangeText={t => setCustomer(p => ({ ...p, name: t }))} />
          <TextInput style={styles.input} placeholder="Phone number" value={customer.phone} onChangeText={t => setCustomer(p => ({ ...p, phone: t }))} keyboardType="phone-pad" />
          {customers.slice(0, 5).map(c => (
            <TouchableOpacity key={c.id} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#f0f0f0' }}
              onPress={() => { setCustomer({ id: c.id, name: c.name, phone: c.phone }); setShowCustomer(false); }}>
              <Text style={{ fontWeight: '600' }}>{c.name}</Text>
              {c.phone ? <Text style={{ color: '#999', fontSize: 12 }}>{c.phone}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList data={cart} renderItem={renderItem} keyExtractor={i => i.id.toString()}
        style={{ flex: 1, paddingHorizontal: 12, paddingTop: 4 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 60, marginBottom: 16, opacity: 0.3 }}>🛒</Text>
            <Text style={{ fontSize: 18, color: '#999' }}>Cart is empty</Text>
            <Text style={{ fontSize: 13, color: '#ccc', marginTop: 4 }}>Scan or tap Quick Add</Text>
          </View>
        }
      />

      {cart.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={{ fontSize: 13, color: '#666' }}>Discount</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableOpacity style={[styles.discTypeBtn, discountType === 'amount' && styles.discTypeActive]}
                onPress={() => { setDiscountType('amount'); setDiscount('0'); }}>
                <Text style={[styles.discTypeText, discountType === 'amount' && styles.discTypeTextActive]}>₹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.discTypeBtn, discountType === 'percent' && styles.discTypeActive]}
                onPress={() => { setDiscountType('percent'); setDiscount('0'); }}>
                <Text style={[styles.discTypeText, discountType === 'percent' && styles.discTypeTextActive]}>%</Text>
              </TouchableOpacity>
              <TextInput style={styles.discountInput} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="0" />
            </View>
          </View>
          {discAmount > 0 && (
            <Text style={{ fontSize: 12, color: '#28a745', textAlign: 'right', marginBottom: 4 }}>
              Saving: {formatCurrency(discAmount)}
            </Text>
          )}
          <View style={styles.footerRow}>
            <Text style={{ fontSize: 13, color: '#666' }}>Payment</Text>
            <View style={styles.payRow}>
              {paymentMethods.map(pm => (
                <TouchableOpacity key={pm} style={[styles.payBtn, paymentMethod === pm && styles.payActive]} onPress={() => setPaymentMethod(pm)}>
                  <Text style={[styles.payText, paymentMethod === pm && styles.payTextActive]}>{pm}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.footerRow}>
            <Text style={{ fontSize: 13, color: '#666' }}>🖨️ Print Bill</Text>
            <Switch value={printBill} onValueChange={setPrintBill} trackColor={{ false: '#ccc', true: '#28a745' }} thumbColor="#fff" />
          </View>
          <View style={styles.totalRow}>
            <View>
              <Text style={{ fontSize: 12, color: '#999' }}>Items: {cart.reduce((s, i) => s + i.quantity, 0)}</Text>
              <Text style={{ fontSize: 12, color: '#999' }}>Total: {formatCurrency(subtotal)}</Text>
            </View>
            <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
          </View>
          <TouchableOpacity style={[styles.checkout, submitting && { opacity: 0.6 }]} onPress={handleCheckout} disabled={submitting}>
            <Text style={styles.checkoutText}>{submitting ? 'Processing...' : `💳 Pay ${formatCurrency(total)}`}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  topTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  topCount: { fontSize: 14, color: '#999', fontWeight: '600' },
  scanBtn: { backgroundColor: '#1a1a2e', padding: 14, marginHorizontal: 12, marginBottom: 8, borderRadius: 10, alignItems: 'center' },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  searchToggle: { paddingHorizontal: 16, marginBottom: 4 },
  searchToggleText: { fontSize: 13, fontWeight: '600', color: '#007bff' },
  searchBox: { marginHorizontal: 12, marginBottom: 8, zIndex: 10 },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  searchResults: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', marginTop: 4, elevation: 5 },
  searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchResultName: { fontSize: 14, fontWeight: '600', color: '#333' },
  searchResultPrice: { fontSize: 13, color: '#28a745', fontWeight: '700' },
  favToggle: { paddingHorizontal: 16, marginBottom: 4 },
  favToggleText: { fontSize: 13, fontWeight: '600', color: '#007bff' },
  favGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  favItem: { width: '30%', backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', elevation: 1 },
  favIcon: { fontSize: 24, marginBottom: 4 },
  favName: { fontSize: 11, fontWeight: '600', color: '#333', textAlign: 'center' },
  favPrice: { fontSize: 10, color: '#28a745', fontWeight: '700', marginTop: 2 },
  custBtn: { backgroundColor: '#fff', padding: 14, marginHorizontal: 12, marginBottom: 8, borderRadius: 10, elevation: 1 },
  custForm: { backgroundColor: '#fff', marginHorizontal: 12, padding: 14, borderRadius: 10, elevation: 2, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, elevation: 1 },
  itemDel: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffe8e8', justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#333' },
  itemPrice: { fontSize: 11, color: '#999', marginTop: 1 },
  qty: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#333' },
  qtyText: { fontSize: 15, fontWeight: '700', width: 28, textAlign: 'center' },
  itemTotal: { fontSize: 15, fontWeight: '700', color: '#28a745', minWidth: 65, textAlign: 'right' },
  footer: { backgroundColor: '#fff', padding: 16, elevation: 4, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingBottom: 24 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  discTypeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f0f0f0' },
  discTypeActive: { backgroundColor: '#007bff' },
  discTypeText: { fontSize: 13, fontWeight: '700', color: '#666' },
  discTypeTextActive: { color: '#fff' },
  discountInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, width: 70, textAlign: 'right' },
  payRow: { flexDirection: 'row', gap: 4 },
  payBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f0f0f0' },
  payActive: { backgroundColor: '#007bff' },
  payText: { fontSize: 11, fontWeight: '600', color: '#666' },
  payTextActive: { color: '#fff' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  totalAmount: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e' },
  checkout: { backgroundColor: '#28a745', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 3 },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
