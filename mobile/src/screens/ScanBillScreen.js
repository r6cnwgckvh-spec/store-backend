import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';

export default function ScanBillScreen({ navigation }) {
  const { colors } = useTheme();
  const [image, setImage] = useState(null);
  const [items, setItems] = useState([]);
  const [rawText, setRawText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState('capture'); // 'capture' | 'review' | 'done'

  const pickImage = async (fromGallery) => {
    const permission = fromGallery
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', fromGallery ? 'Gallery permission is required.' : 'Camera permission is required.');
      return;
    }

    const result = await (fromGallery
      ? ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true })
      : ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true }));

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setImage(asset.uri);
    setProcessing(true);

    try {
      const data = await api.post('/bill-scan/ocr', { image: asset.base64 });
      setRawText(data.text || '');
      if (data.items?.length > 0) {
        setItems(data.items.map(item => ({
          name: item.name || '',
          barcode: item.barcode || '',
          quantity: String(item.quantity || 1),
          cost_price: String(item.cost_price || ''),
          selling_price: item.selling_price > 0 ? String(item.selling_price.toFixed(2)) : '',
          category: item.category || '',
        })));
        setStage('review');
      } else {
        setItems([{ name: '', barcode: '', quantity: '1', cost_price: '', selling_price: '', category: '' }]);
        setStage('review');
        Alert.alert('No items found', 'Could not auto-detect items. Please enter them manually.');
      }
    } catch (e) {
      Alert.alert('OCR Failed', e.message + '\n\nEnter items manually.');
      setItems([{ name: '', barcode: '', quantity: '1', cost_price: '', selling_price: '', category: '' }]);
      setStage('review');
    }
    setProcessing(false);
  };

  const updateItem = (index, field, value) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems([...items, { name: '', barcode: '', quantity: '1', cost_price: '', selling_price: '', category: '' }]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
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
          quantity: parseInt(item.quantity) || 1,
          cost_price: parseFloat(item.cost_price) || 0,
          selling_price: parseFloat(item.selling_price) || 0,
          category: item.category.trim(),
        })),
      };
      const result = await api.post('/bill-scan', payload);
      const msg = [
        result.created?.length ? `Created: ${result.created.length} new products` : '',
        result.updated?.length ? `Updated: ${result.updated.length} existing products` : '',
        result.skipped?.length ? `Skipped: ${result.skipped.length} items` : '',
      ].filter(Boolean).join('\n');
      Alert.alert('Saved to Inventory', msg || 'Done', [
        { text: 'OK', onPress: () => { setItems([]); setImage(null); setRawText(''); setStage('capture'); } },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setSubmitting(false);
  };

  const reset = () => {
    setItems([]);
    setImage(null);
    setRawText('');
    setStage('capture');
  };

  const styles = createStyles(colors);

  if (stage === 'review') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={reset} style={styles.backBtn}>
            <Text style={styles.backText}>← New Scan</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Items</Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
          {image && (
            <Image source={{ uri: image }} style={styles.reviewPreview} resizeMode="contain" />
          )}

          {rawText ? (
            <TouchableOpacity onPress={() => Alert.alert('Raw OCR Text', rawText)}>
              <Text style={styles.rawTextLink}>View raw OCR text</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.sectionTitle}>
            Items ({items.length})
          </Text>

          {items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemNumber}>#{index + 1}</Text>
                <TouchableOpacity onPress={() => removeItem(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={styles.input} placeholder="Product name *" placeholderTextColor={colors.placeholder}
                value={item.name} onChangeText={(v) => updateItem(index, 'name', v)} />
              <TextInput style={styles.input} placeholder="Barcode (optional)" placeholderTextColor={colors.placeholder}
                value={item.barcode} onChangeText={(v) => updateItem(index, 'barcode', v)} />
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.halfInput]} placeholder="Qty" placeholderTextColor={colors.placeholder}
                  value={item.quantity} onChangeText={(v) => updateItem(index, 'quantity', v)} keyboardType="numeric" />
                <TextInput style={[styles.input, styles.halfInput]} placeholder="Category" placeholderTextColor={colors.placeholder}
                  value={item.category} onChangeText={(v) => updateItem(index, 'category', v)} />
              </View>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.halfInput]} placeholder="Cost Price" placeholderTextColor={colors.placeholder}
                  value={item.cost_price} onChangeText={(v) => updateItem(index, 'cost_price', v)} keyboardType="decimal-pad" />
                <TextInput style={[styles.input, styles.halfInput]} placeholder="Selling Price" placeholderTextColor={colors.placeholder}
                  value={item.selling_price} onChangeText={(v) => updateItem(index, 'selling_price', v)} keyboardType="decimal-pad" />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addItem}>
            <Text style={styles.addBtnText}>+ Add Missing Item</Text>
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Bill</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
        {processing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingText}>Scanning bill with OCR...</Text>
            <Text style={styles.processingSub}>Extracting items from image</Text>
          </View>
        ) : (
          <View style={styles.imageSection}>
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>🧾</Text>
              <Text style={styles.placeholderTitle}>Scan Supplier Bill</Text>
              <Text style={styles.placeholderText}>
                Take a photo of the bill{'\n'}Items will be auto-detected
              </Text>
              <View style={styles.imageButtons}>
                <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage(false)}>
                  <Text style={styles.imageBtnText}>📷 Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.imageBtn, { backgroundColor: colors.textMuted }]} onPress={() => pickImage(true)}>
                  <Text style={styles.imageBtnText}>🖼️ Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {!processing && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>1. Take a clear photo of the supplier bill</Text>
            <Text style={styles.infoText}>2. OCR extracts items automatically</Text>
            <Text style={styles.infoText}>3. Review and edit items</Text>
            <Text style={styles.infoText}>4. Save all to inventory</Text>
          </View>
        )}
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
  processingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  processingText: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 20 },
  processingSub: { fontSize: 13, color: colors.textMuted, marginTop: 6 },
  imageSection: { marginBottom: 20 },
  reviewPreview: { width: '100%', height: 160, borderRadius: 10, backgroundColor: colors.card, marginBottom: 12 },
  rawTextLink: { fontSize: 13, color: colors.primary, textAlign: 'center', marginBottom: 12, textDecorationLine: 'underline' },
  placeholder: {
    backgroundColor: colors.card, borderRadius: 12, padding: 32,
    alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
  },
  placeholderIcon: { fontSize: 56, marginBottom: 12 },
  placeholderTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  placeholderText: { fontSize: 14, color: colors.textMuted, marginBottom: 20, textAlign: 'center', lineHeight: 20 },
  imageButtons: { flexDirection: 'row', gap: 12 },
  imageBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.primary },
  imageBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  infoBox: { backgroundColor: colors.card, borderRadius: 10, padding: 16, marginTop: 8 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  infoText: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 8 },
  itemCard: {
    backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemNumber: { fontSize: 13, fontWeight: '700', color: colors.primary },
  removeText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  addBtn: {
    padding: 14, borderRadius: 8, borderWidth: 2, borderColor: colors.primary,
    borderStyle: 'dashed', alignItems: 'center', marginBottom: 16,
  },
  addBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  submitBtn: { padding: 16, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
