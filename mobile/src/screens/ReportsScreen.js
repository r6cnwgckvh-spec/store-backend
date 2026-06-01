import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { formatCurrency, formatDate } from '../utils/helpers';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

const periods = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export default function ReportsScreen({ navigation }) {
  const [period, setPeriod] = useState('month');
  const [sales, setSales] = useState(null);
  const [stockVal, setStockVal] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [s, sv] = await Promise.all([
        api.getSalesReport({ period }),
        api.getStockValue(),
      ]);
      setSales(s);
      setStockVal(sv);
    } catch (e) { console.error(e); }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const printReport = async () => {
    if (!sales) return;
    const periodLabel = periods.find(p => p.key === period)?.label || period;
    const topHtml = topProducts.map(p => `<tr><td>${p.product_name}</td><td style="text-align:center">${p.qty}</td><td style="text-align:right">${formatCurrency(p.revenue)}</td><td style="text-align:right">${formatCurrency(p.profit)}</td></tr>`).join('');
    const methodHtml = paymentMethods.map(pm => `<tr><td>${pm.payment_method}</td><td style="text-align:center">${pm.count}</td><td style="text-align:right">${formatCurrency(pm.total)}</td></tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial, sans-serif; padding: 30px; font-size: 13px; }
      h1 { text-align: center; font-size: 22px; margin-bottom: 4px; }
      .period { text-align: center; color: #666; margin-bottom: 20px; }
      .summary { display: flex; justify-content: space-around; margin-bottom: 20px; }
      .card { text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 8px; min-width: 80px; }
      .card .val { font-size: 18px; font-weight: bold; }
      .card .lbl { font-size: 11px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th { background: #1a1a2e; color: #fff; padding: 8px; text-align: left; }
      td { padding: 8px; border-bottom: 1px solid #ddd; }
      h2 { font-size: 16px; margin-top: 20px; }
    </style></head><body>
      <h1>Sales Report</h1>
      <div class="period">Period: ${periodLabel}</div>
      <div class="summary">
        <div class="card"><div class="val">${s.order_count || 0}</div><div class="lbl">Orders</div></div>
        <div class="card"><div class="val">${formatCurrency(s.total_revenue || 0)}</div><div class="lbl">Revenue</div></div>
        <div class="card"><div class="val">${formatCurrency(profit?.total_profit || 0)}</div><div class="lbl">Profit</div></div>
        <div class="card"><div class="val">${formatCurrency(s.total_discount || 0)}</div><div class="lbl">Discounts</div></div>
      </div>
      ${topProducts.length > 0 ? `<h2>Top Products</h2><table><thead><tr><th>Product</th><th>Sold</th><th>Revenue</th><th>Profit</th></tr></thead><tbody>${topHtml}</tbody></table>` : ''}
      ${paymentMethods.length > 0 ? `<h2>Payment Methods</h2><table><thead><tr><th>Method</th><th>Orders</th><th>Total</th></tr></thead><tbody>${methodHtml}</tbody></table>` : ''}
      <p style="text-align:center;color:#999;margin-top:30px;font-size:11px">Generated on ${new Date().toLocaleString()}</p>
    </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Sales Report' });
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const s = sales?.summary || {};
  const profit = sales?.profitSummary;
  const topProducts = sales?.topProducts || [];
  const paymentMethods = sales?.paymentMethods || [];
  const dailySales = sales?.dailySales || [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reports</Text>
        <TouchableOpacity onPress={printReport} style={styles.printBtn}>
          <Text style={styles.printBtnText}>🖨️ PDF</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.periodRow}>
          {periods.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#28a745' }]}>
            <Text style={[styles.statValue, { color: '#28a745' }]}>{s.order_count || 0}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#007bff' }]}>
            <Text style={[styles.statValue, { color: '#007bff', fontSize: 18 }]}>{formatCurrency(s.total_revenue || 0)}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#ffc107' }]}>
            <Text style={[styles.statValue, { color: '#ffc107', fontSize: 18 }]}>{formatCurrency(s.total_discount || 0)}</Text>
            <Text style={styles.statLabel}>Discounts</Text>
          </View>
        </View>

        {stockVal && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: '#17a2b8' }]}>
              <Text style={[styles.statValue, { color: '#17a2b8', fontSize: 18 }]}>{stockVal.totalProducts}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#6f42c1' }]}>
              <Text style={[styles.statValue, { color: '#6f42c1', fontSize: 18 }]}>{formatCurrency(stockVal.stockValue)}</Text>
              <Text style={styles.statLabel}>Stock Value</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#e83e8c' }]}>
              <Text style={[styles.statValue, { color: '#e83e8c', fontSize: 18 }]}>{profit ? formatCurrency(profit.total_profit) : '-'}</Text>
              <Text style={styles.statLabel}>Profit</Text>
            </View>
          </View>
        )}

        {topProducts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Products</Text>
            {topProducts.map((p, i) => (
              <View key={p.product_id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{i + 1}. {p.product_name}</Text>
                  <Text style={styles.itemSub}>Sold: {p.qty} units</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemPrice}>{formatCurrency(p.revenue)}</Text>
                  <Text style={styles.itemProfit}>Profit: {formatCurrency(p.profit)}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {paymentMethods.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            {paymentMethods.map(pm => (
              <View key={pm.payment_method} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{pm.payment_method || 'N/A'}</Text>
                  <Text style={styles.itemSub}>{pm.count} orders</Text>
                </View>
                <Text style={styles.itemPrice}>{formatCurrency(pm.total)}</Text>
              </View>
            ))}
          </>
        )}

        {dailySales.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Daily Sales</Text>
            {dailySales.map((d, i) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{d.date}</Text>
                  <Text style={styles.itemSub}>{d.orders} orders</Text>
                </View>
                <Text style={styles.itemPrice}>{formatCurrency(d.revenue)}</Text>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backBtn: { fontSize: 16, color: '#007bff', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  printBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#007bff' },
  printBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { padding: 16 },
  periodRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', elevation: 1 },
  periodActive: { backgroundColor: '#007bff' },
  periodText: { fontSize: 12, fontWeight: '600', color: '#333' },
  periodTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderLeftWidth: 4, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 10, color: '#666', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 10, marginTop: 8 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#333' },
  itemSub: { fontSize: 11, color: '#999', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#28a745' },
  itemProfit: { fontSize: 11, color: '#e83e8c', marginTop: 2 },
});
