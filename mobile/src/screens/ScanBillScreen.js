import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';

export default function ScanBillScreen({ navigation }) {
  const { colors } = useTheme();
  const [items, setItems] = useState([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  function emptyItem() {
    return {
      name: '',
      barcode: '',
      is_medicine: false,
      tablets_per_strip: '10',
      stock: '',
      strips: '',
      cost_price: '',
      selling_price: '',
      category: '',
      expiry_date: '',
    };
  }

  const updateItem = (index, field, value) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems([...items, emptyItem()]);

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const toggleMedicine = (index) => {
    setItems(items.map((item, i) => i === index ? { ...item, is_medicine: !item.is_medicine } : item));
  };

  const openBarcodeScanner = (index) => {
    navigation.navigate('Scanner', { onBarCodeScanned: (barcode) => updateItem(index, 'barcode', barcode) });
  };

  const handleSubmit = async () => {
    const validItems = items.filter(item => item.name.trim());
    if (validItems.length === 0) {
      Alert.alert('No items', 'Add at least one item with a name.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: validItems.map(item => ({
          name: item.name.trim(),
          barcode: item.barcode.trim() || undefined,
          is_medicine: item.is_medicine,
          quantity: item.is_medicine ? (parseInt(item.strips) || 1) : (parseInt(item.stock) || 1),
          tablets_per_strip: item.is_medicine ? (parseInt(item.tablets_per_strip) || 10) : 1,
          cost_price: parseFloat(item.cost_price) || 0,
          selling_price: parseFloat(item.selling_price) || 0,
          category: item.category.trim(),
          expiry_date: item.expiry_date.trim(),
        })),
      };
      const result = await api.post('/bill-scan', payload);
      const msg = [
        result.created?.length ? `Created: ${result.created.length} new products` : '',
        result.updated?.length ? `Updated: ${result.updated.length} existing products` : '',
        result.skipped?.length ? `Skipped: ${result.skipped.length} items` : '',
      ].filter(Boolean).join('\n');
      Alert.alert('Saved to Inventory', msg || 'Done', [
        { text: 'Add More', onPress: () => setItems([emptyItem()]) },
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setSubmitting(false);
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Multiple Items</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
        {items.map((item, index) => (
          <View key={index} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemNumber}>Item #{index + 1}</Text>
              <View style={styles.itemHeaderRight}>
                <TouchableOpacity onPress={() => removeItem(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput style={styles.input} placeholder="Product name *" placeholderTextColor={colors.placeholder}
              value={item.name} onChangeText={(v) => updateItem(index, 'name', v)} />

            <View style={styles.barcodeRow}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Barcode (optional)" placeholderTextColor={colors.placeholder}
                value={item.barcode} onChangeText={(v) => updateItem(index, 'barcode', v)} />
              <TouchableOpacity style={styles.scanBtn} onPress={() => openBarcodeScanner(index)}>
                <Text style={styles.scanBtnText}>Scan</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.toggleRow} onPress={() => toggleMedicine(index)}>
              <Text style={styles.toggleLabel}>Type:</Text>
              <View style={[styles.togglePill, item.is_medicine && styles.togglePillActive]}>
                <Text style={[styles.togglePillText, item.is_medicine && styles.togglePillTextActive]}>Medicine</Text>
              </View>
              <Text style={styles.toggleOr}>/</Text>
              <View style={[styles.togglePill, !item.is_medicine && styles.togglePillActive]}>
                <Text style={[styles.togglePillText, !item.is_medicine && styles.togglePillTextActive]}>General</Text>
              </View>
            </TouchableOpacity>

            {item.is_medicine ? (
              <View style={styles.row}>
                <View style={styles.halfBlock}>
                  <Text style={styles.fieldLabel}>Tablets per strip</Text>
                  <TextInput style={styles.input} placeholder="10" placeholderTextColor={colors.placeholder}
                    value={item.tablets_per_strip} onChangeText={(v) => updateItem(index, 'tablets_per_strip', v)} keyboardType="numeric" />
                </View>
                <View style={styles.halfBlock}>
                  <Text style={styles.fieldLabel}>Strips (stock)</Text>
                  <TextInput style={styles.input} placeholder="1" placeholderTextColor={colors.placeholder}
                    value={item.strips} onChangeText={(v) => updateItem(index, 'strips', v)} keyboardType="numeric" />
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>Stock quantity</Text>
                <TextInput style={styles.input} placeholder="1" placeholderTextColor={colors.placeholder}
                  value={item.stock} onChangeText={(v) => updateItem(index, 'stock', v)} keyboardType="numeric" />
              </View>
            )}

            <View style={styles.row}>
              <View style={styles.halfBlock}>
                <Text style={styles.fieldLabel}>Cost Price</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor={colors.placeholder}
                  value={item.cost_price} onChangeText={(v) => updateItem(index, 'cost_price', v)} keyboardType="decimal-pad" />
              </View>
              <View style={styles.halfBlock}>
                <Text style={styles.fieldLabel}>Selling Price</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor={colors.placeholder}
                  value={item.selling_price} onChangeText={(v) => updateItem(index, 'selling_price', v)} keyboardType="decimal-pad" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfBlock}>
                <Text style={styles.fieldLabel}>Category</Text>
                <TextInput style={styles.input} placeholder="e.g. Tablets" placeholderTextColor={colors.placeholder}
                  value={item.category} onChangeText={(v) => updateItem(index, 'category', v)} />
              </View>
              <View style={styles.halfBlock}>
                <Text style={styles.fieldLabel}>Expiry Date</Text>
                <TextInput style={styles.input} placeholder="MM/YYYY" placeholderTextColor={colors.placeholder}
                  value={item.expiry_date} onChangeText={(v) => updateItem(index, 'expiry_date', v)} />
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addItem}>
          <Text style={styles.addBtnText}>+ Add Another Item</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>
            {submitting ? 'Saving...' : `Save ${items.filter(i => i.name.trim()).length} Items to Inventory`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.headerBg,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 16, color: colors.headerText, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.headerText },
  body: { flex: 1, padding: 16 },
  itemCard: {
    backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemNumber: { fontSize: 14, fontWeight: '700', color: colors.primary },
  itemHeaderRight: { flexDirection: 'row', gap: 12 },
  removeText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  barcodeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  scanBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, backgroundColor: colors.primary },
  scanBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  toggleLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  togglePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  togglePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  togglePillText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  togglePillTextActive: { color: '#fff' },
  toggleOr: { fontSize: 13, color: colors.textMuted },
  fieldLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4, marginTop: -4 },
  row: { flexDirection: 'row', gap: 8 },
  halfBlock: { flex: 1 },
  addBtn: {
    padding: 14, borderRadius: 8, borderWidth: 2, borderColor: colors.primary,
    borderStyle: 'dashed', alignItems: 'center', marginBottom: 16,
  },
  addBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  submitBtn: { padding: 16, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
