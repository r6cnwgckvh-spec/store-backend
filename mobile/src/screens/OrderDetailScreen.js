import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { formatCurrency, formatDate } from '../utils/helpers';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../context/ThemeContext';

let cachedSettings = null;

async function getSettings() {
  if (cachedSettings) return cachedSettings;
  try { cachedSettings = await api.getSettings(); return cachedSettings; }
  catch (e) { return { store_name: 'Store', address: '', phone: '', email: '', tax_id: '' }; }
}

export default function OrderDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [order, setOrder] = useState(route.params?.order || null);
  const [loading, setLoading] = useState(!order);

  useEffect(() => {
    if (!order && route.params?.id) loadOrder();
    if (route.params?.printPdf && order) setTimeout(generatePdf, 600);
  }, []);

  const loadOrder = async () => {
    try { setOrder(await api.getOrder(route.params.id)); }
    catch (e) { Alert.alert('Error', 'Order not found'); navigation.goBack(); }
    finally { setLoading(false); }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Order',
      `Are you sure you want to delete order #${order.id}? Stock will be restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteOrder(order.id);
              Alert.alert('Deleted', 'Order deleted, stock restored');
              navigation.goBack();
            } catch (e) { Alert.alert('Error', e.message); }
          },
        },
      ]
    );
  };

  const generatePdf = async () => {
    if (!order) return;
    const s = await getSettings();

    const itemsHtml = order.items.map(item => `
      <tr><td>${item.product_name}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:center">${formatCurrency(item.price)}</td><td style="text-align:right">${formatCurrency(item.price * item.quantity)}</td></tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: 'Courier New', monospace; padding: 30px; font-size: 14px; }
      .header { text-align: center; margin-bottom: 20px; }
      .store-name { font-size: 24px; font-weight: bold; }
      .store-detail { font-size: 12px; color: #666; }
      .divider { border-top: 2px dashed #333; margin: 15px 0; }
      .bill-title { text-align: center; font-size: 18px; font-weight: bold; margin: 15px 0; }
      .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th { border-bottom: 2px solid #333; padding: 8px 4px; text-align: left; font-size: 13px; }
      td { padding: 8px 4px; border-bottom: 1px solid #ddd; font-size: 13px; }
      .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; }
      .footer { text-align: center; font-size: 11px; color: #999; margin-top: 30px; }
    </style></head><body>
      <div class="header">
        <div class="store-name">${s.store_name}</div>
        ${s.address ? `<div class="store-detail">${s.address}</div>` : ''}
        ${s.phone ? `<div class="store-detail">Phone: ${s.phone}</div>` : ''}
        ${s.email ? `<div class="store-detail">Email: ${s.email}</div>` : ''}
        ${s.tax_id ? `<div class="store-detail">${s.tax_id}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="bill-title">TAX INVOICE</div>
      <div class="info-row"><span><strong>Bill No:</strong> ${order.id}</span><span><strong>Date:</strong> ${formatDate(order.created_at)}</span></div>
      <div class="info-row"><span><strong>Customer:</strong> ${order.customer_name || 'Walk-in'}</span>${order.customer_phone ? `<span><strong>Phone:</strong> ${order.customer_phone}</span>` : ''}</div>
      <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:center">Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <div class="total-row"><span>Total</span><span>${formatCurrency(order.total_amount)}</span></div>
      <div style="text-align:center;font-size:12px;color:#999;margin-top:8px">Items: ${order.items_count}</div>
      <div class="divider"></div>
      <div class="footer">Made by Kishan ❤️<br>Thank you!<br>Goods once sold will not be taken back.</div>
    </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const pdfName = `Bill_${order.id}_${Date.now()}.pdf`;
      const permUri = FileSystem.documentDirectory + pdfName;
      await FileSystem.moveAsync({ from: uri, to: permUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(permUri, { mimeType: 'application/pdf', dialogTitle: `Bill #${order.id}` });
      } else {
        Alert.alert('PDF Saved', `Bill saved`);
      }
    } catch (e) { Alert.alert('PDF Error', e.message); }
  };

  const sendSmsBill = () => {
    if (!order.customer_phone) return Alert.alert('No Phone', 'Customer has no phone number');
    const s = cachedSettings || { store_name: 'Store' };
    const items = order.items.map(i => `${i.product_name} x${i.quantity}`).join(', ');
    const msg = `${s.store_name}\nBill #${order.id}\n${items}\nTotal: ${formatCurrency(order.total_amount)}\nThank you!`;
    const url = `sms:${order.customer_phone}?body=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
  };

  // Auto-trigger SMS if printPdf and customer has phone
  useEffect(() => {
    if (route.params?.printPdf && order && order.customer_phone) {
      const timer = setTimeout(sendSmsBill, 2000);
      return () => clearTimeout(timer);
    }
  }, [order]);

  if (loading) return <View style={styles.center}><Text>Loading...</Text></View>;
  if (!order) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
          <Text style={styles.topBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Order #{order.id}</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.topBtn}>
          <Text style={[styles.topBtnText, { color: colors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.billHeader}>
          <Text style={styles.billTitle}>Bill #{order.id}</Text>
          <Text style={styles.date}>{formatDate(order.created_at)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.secLabel}>Customer</Text>
          <Text style={styles.custName}>{order.customer_name || 'Walk-in Customer'}</Text>
          {order.customer_phone ? <Text style={styles.custPhone}>{order.customer_phone}</Text> : null}
        </View>

        <Text style={styles.heading}>Items ({order.items_count})</Text>
        {order.items.map(item => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemSub}>Qty: {item.quantity} x {formatCurrency(item.price)}</Text>
            </View>
            <Text style={styles.itemTotal}>{formatCurrency(item.price * item.quantity)}</Text>
          </View>
        ))}

        <View style={styles.totalSection}>
          <Text style={{ color: colors.headerText, fontSize: 16, fontWeight: '600' }}>Total</Text>
          <Text style={{ color: colors.headerText, fontSize: 22, fontWeight: 'bold' }}>{formatCurrency(order.total_amount)}</Text>
        </View>

        <TouchableOpacity style={styles.pdfBtn} onPress={generatePdf}>
          <Text style={styles.pdfBtnText}>📄 Share PDF Bill</Text>
        </TouchableOpacity>

        {order.customer_phone ? (
          <TouchableOpacity style={styles.smsBtn} onPress={sendSmsBill}>
            <Text style={styles.smsBtnText}>📱 Send SMS Bill</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.delBtn} onPress={handleDelete}>
          <Text style={styles.delBtnText}>🗑 Delete Order</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.background },
  topBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  topBtnText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  topTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  billHeader: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  billTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  date: { fontSize: 13, color: colors.textLight, marginTop: 4 },
  section: { backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 16, elevation: 1 },
  secLabel: { fontSize: 11, color: colors.textLight, textTransform: 'uppercase', marginBottom: 4 },
  custName: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  custPhone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 6, elevation: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  itemSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemTotal: { fontSize: 16, fontWeight: '700', color: colors.success },
  totalSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.headerBg, borderRadius: 12, padding: 18, marginTop: 12 },
  pdfBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20, elevation: 3 },
  pdfBtnText: { color: colors.headerText, fontSize: 16, fontWeight: '700' },
  smsBtn: { backgroundColor: '#25D366', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12, elevation: 3 },
  smsBtnText: { color: colors.headerText, fontSize: 16, fontWeight: '700' },
  delBtn: { backgroundColor: colors.card, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: colors.danger },
  delBtnText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
