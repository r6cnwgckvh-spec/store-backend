import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';

const emptyItem = {
  name: '',
  barcode: '',
  quantity: '1',
  cost_price: '',
  selling_price: '',
  category: '',
};

export default function ScanBillScreen({ navigation }) {
  const { colors } = useTheme();
  const [image, setImage] = useState(null);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required to scan bills.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      setImage(result.assets[0].uri);
    }
  };

  const pickGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Gallery permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      setImage(result.assets[0].uri);
    }
  };

  const updateItem = (index, field, value) => {
    const updated = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { ...emptyItem }]);
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
        notes: '',
      };
      const result = await api.post('/bill-scan', payload);
      const msg = [
        result.created?.length ? `Created: ${result.created.length} products` : '',
        result.updated?.length ? `Updated: ${result.updated.length} products` : '',
        result.skipped?.length ? `Skipped: ${result.skipped.length} items` : '',
      ].filter(Boolean).join('\n');
      Alert.alert('Bill Scanned', msg || 'Done', [
        { text: 'OK', onPress: () => { setItems([{ ...emptyItem }]); setImage(null); } },
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
        <Text style={styles.headerTitle}>Scan Bill</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.imageSection}>
          {image ? (
            <View>
              <Image source={{ uri: image }} style={styles.preview} resizeMode="contain" />
              <TouchableOpacity style={styles.changeBtn} onPress={pickImage}>
                <Text style={styles.changeBtnText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>🧾</Text>
              <Text style={styles.placeholderText}>Take a photo of the supplier bill</Text>
              <View style={styles.imageButtons}>
                <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                  <Text style={styles.imageBtnText}>📷 Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageBtn} onPress={pickGallery}>
                  <Text style={styles.imageBtnText}>🖼️ Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Items ({items.length})</Text>

        {items.map((item, index) => (
          <View key={index} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemNumber}>Item #{index + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Product name *"
              placeholderTextColor={colors.placeholder}
              value={item.name}
              onChangeText={(v) => updateItem(index, 'name', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Barcode (optional)"
              placeholderTextColor={colors.placeholder}
              value={item.barcode}
              onChangeText={(v) => updateItem(index, 'barcode', v)}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Qty"
                placeholderTextColor={colors.placeholder}
                value={item.quantity}
                onChangeText={(v) => updateItem(index, 'quantity', v)}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Category"
                placeholderTextColor={colors.placeholder}
                value={item.category}
                onChangeText={(v) => updateItem(index, 'category', v)}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Cost Price"
                placeholderTextColor={colors.placeholder}
                value={item.cost_price}
                onChangeText={(v) => updateItem(index, 'cost_price', v)}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Selling Price"
                placeholderTextColor={colors.placeholder}
                value={item.selling_price}
                onChangeText={(v) => updateItem(index, 'selling_price', v)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addItem}>
          <Text style={styles.addBtnText}>+ Add Another Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Saving...' : 'Save All to Inventory'}
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
  imageSection: { marginBottom: 20 },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.card },
  changeBtn: { marginTop: 8, alignSelf: 'center' },
  changeBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  placeholder: {
    backgroundColor: colors.card, borderRadius: 12, padding: 24,
    alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
  },
  placeholderIcon: { fontSize: 48, marginBottom: 8 },
  placeholderText: { fontSize: 14, color: colors.textMuted, marginBottom: 16, textAlign: 'center' },
  imageButtons: { flexDirection: 'row', gap: 12 },
  imageBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary,
  },
  imageBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  itemCard: {
    backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
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
  submitBtn: {
    padding: 16, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
