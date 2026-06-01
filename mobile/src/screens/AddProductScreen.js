import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';

// Field MUST be outside the component — defining it inside causes re-render on every keystroke
const Field = ({ label, value, onChange, placeholder, keyboardType, multiline }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
    />
  </View>
);

export default function AddProductScreen({ route, navigation }) {
  const p = route.params?.product;
  const [isMedicine, setIsMedicine] = useState(p ? (p.tablets_per_strip || 1) > 1 : false);
  const [barcode, setBarcode] = useState(route.params?.barcode || (p ? p.barcode : ''));
  const [name, setName] = useState(p ? p.name : '');
  const [costPrice, setCostPrice] = useState(p ? String(p.cost_price || '0') : '');
  const [sellingPrice, setSellingPrice] = useState(p ? String(p.price) : '');
  const [tabletsPerStrip, setTabletsPerStrip] = useState(p ? String(p.tablets_per_strip || '1') : '10');
  const [stock, setStock] = useState(p ? String(Math.ceil(p.stock / (p.tablets_per_strip || 1))) : '');
  const [category, setCategory] = useState(p ? p.category : '');
  const [size, setSize] = useState(p ? p.size : '');
  const [description, setDescription] = useState(p ? p.description : '');
  const [image, setImage] = useState(p ? p.image_url : '');
  const [loading, setLoading] = useState(false);

  const pickImage = (useCamera) => {
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Grant camera access to capture photo'); return; }
        const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5, allowsEditing: true, aspect: [1, 1] });
        if (!result.canceled) setImage(result.assets[0].base64 || '');
      }},
      { text: 'Choose from Gallery', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Grant gallery access to add product image'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, allowsEditing: true, aspect: [1, 1] });
        if (!result.canceled) setImage(result.assets[0].base64 || '');
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!barcode.trim()) return Alert.alert('Error', 'Scan or enter a barcode');
    if (!name.trim()) return Alert.alert('Error', 'Product name is required');
    if (!sellingPrice.trim() || isNaN(parseFloat(sellingPrice))) return Alert.alert('Error', 'Valid selling price required');

    setLoading(true);
    try {
      const tps = isMedicine ? (parseInt(tabletsPerStrip) || 1) : 1;
      let imageUrl = image || '';
      if (image && image.length > 1000) {
        const uploadJson = await api.post('/images', { image });
        if (uploadJson.url) imageUrl = uploadJson.url;
      }
      const data = { barcode: barcode.trim(), name: name.trim(), price: parseFloat(sellingPrice), cost_price: parseFloat(costPrice) || 0, tablets_per_strip: tps, stock: isMedicine ? (parseInt(stock) || 0) * tps : (parseInt(stock) || 0), category, size, description, image_url: imageUrl };
      if (p) { await api.updateProduct(p.id, data); Alert.alert('Success', 'Product updated'); }
      else { await api.createProduct(data); Alert.alert('Success', 'Product added'); }
      navigation.navigate('ProductsList');
    } catch (e) {
      let msg = e.message;
      try { const j = JSON.parse(e.message); msg = j.error || msg; } catch {}
      if (msg.includes('already exists')) {
        Alert.alert('Duplicate', 'This barcode already exists', [{ text: 'OK' }]);
      } else Alert.alert('Error', msg);
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={styles.title}>{p ? 'Edit Product' : 'Add Product'}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ProductsList')} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('Scanner', { mode: 'add' })}>
          <Text style={styles.scanBtnText}>📷 Scan Barcode</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: `data:image/jpeg;base64,${image}` }} style={styles.productImage} />
          ) : (
            <Text style={styles.imagePickerText}>📷 Add Photo</Text>
          )}
        </TouchableOpacity>

        <View style={styles.typeToggle}>
          <TouchableOpacity style={[styles.typeBtn, !isMedicine && styles.typeActive]} onPress={() => setIsMedicine(false)}>
            <Text style={[styles.typeBtnText, !isMedicine && styles.typeTextActive]}>📦 General</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, isMedicine && styles.typeActive]} onPress={() => setIsMedicine(true)}>
            <Text style={[styles.typeBtnText, isMedicine && styles.typeTextActive]}>💊 Medicine</Text>
          </TouchableOpacity>
        </View>

        <Field label="Barcode" value={barcode} onChange={setBarcode} placeholder="Scan or type" />
        <Field label="Name *" value={name} onChange={setName} placeholder="Product name" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="Cost Price" value={costPrice} onChange={setCostPrice} placeholder="0.00" keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Selling Price *" value={sellingPrice} onChange={setSellingPrice} placeholder="0.00" keyboardType="decimal-pad" /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {isMedicine && <View style={{ flex: 1 }}><Field label="Tablets/Strip" value={tabletsPerStrip} onChange={setTabletsPerStrip} placeholder="10" keyboardType="number-pad" /></View>}
          <View style={{ flex: isMedicine ? 1 : 1 }}><Field label={isMedicine ? "Stock (strips)" : "Stock"} value={stock} onChange={setStock} placeholder="0" keyboardType="number-pad" /></View>
        </View>
        <Field label="Category" value={category} onChange={setCategory} placeholder="e.g. Oil, Grain" />
        <Field label="Size" value={size} onChange={setSize} placeholder="e.g. 1L, 500g" />
        <Field label="Description" value={description} onChange={setDescription} placeholder="Optional" multiline />

        <TouchableOpacity style={[styles.submit, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.submitText}>{loading ? 'Saving...' : p ? 'Update Product' : 'Add to Inventory'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0f0f0' },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#666' },
  imagePicker: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed', overflow: 'hidden' },
  productImage: { width: '100%', height: '100%', borderRadius: 12 },
  imagePickerText: { fontSize: 13, color: '#999', fontWeight: '600' },
  scanBtn: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20, elevation: 3 },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  typeToggle: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  typeActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
  typeTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginLeft: 2 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },
  submit: { backgroundColor: '#28a745', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, elevation: 3 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});