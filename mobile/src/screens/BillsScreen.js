import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';

export default function BillsScreen({ navigation }) {
  const { colors } = useTheme();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(useCallback(() => { loadBills(); }, []));

  const loadBills = async () => {
    try {
      const data = await api.get('/bills');
      setBills(data);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required to take bill photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      await api.post('/bills', { image_data: result.assets[0].base64 });
      Alert.alert('Saved', 'Bill photo saved.');
      loadBills();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setUploading(false);
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      await api.post('/bills', { image_data: result.assets[0].base64 });
      Alert.alert('Saved', 'Bill photo saved.');
      loadBills();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setUploading(false);
  };

  const uploadOptions = () => {
    Alert.alert('Upload Bill', '', [
      { text: 'Take Photo', onPress: pickImage },
      { text: 'Choose from Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const viewBill = (bill) => {
    Alert.alert('Bill Details', `Uploaded: ${new Date(bill.created_at).toLocaleDateString()}\nNotes: ${bill.notes || 'None'}`, [
      { text: 'View Image', onPress: () => viewBillImage(bill) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBill(bill.id) },
      { text: 'OK' },
    ]);
  };

  const viewBillImage = (bill) => {
    Alert.alert('Bill Photo', '', [
      { text: 'Close' },
    ]);
  };

  const deleteBill = (id) => {
    Alert.alert('Delete', 'Delete this bill photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/bills/${id}`);
          loadBills();
        } catch (e) {
          Alert.alert('Error', e.message);
        }
      }},
    ]);
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bills</Text>
        <TouchableOpacity onPress={uploadOptions} style={styles.uploadBtn}>
          <Text style={styles.uploadBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {uploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : bills.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No Bills Yet</Text>
            <Text style={styles.emptyText}>Upload photos of your supplier bills to keep them stored in one place.</Text>
            <TouchableOpacity style={styles.addFirstBtn} onPress={uploadOptions}>
              <Text style={styles.addFirstBtnText}>Upload First Bill</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bills.map((bill) => (
            <TouchableOpacity key={bill.id} style={styles.billCard} onPress={() => viewBill(bill)}>
              <Image source={{ uri: `data:image/jpeg;base64,${bill.image_data}` }} style={styles.billThumb} />
              <View style={styles.billInfo}>
                <Text style={styles.billDate}>{new Date(bill.created_at).toLocaleDateString()}</Text>
                <Text style={styles.billTime}>{new Date(bill.created_at).toLocaleTimeString()}</Text>
                {bill.notes ? <Text style={styles.billNotes}>{bill.notes}</Text> : null}
              </View>
            </TouchableOpacity>
          ))
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
  uploadBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.primary },
  uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  uploadingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, backgroundColor: colors.primary, gap: 8,
  },
  uploadingText: { color: '#fff', fontSize: 13 },
  body: { flex: 1, padding: 16 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 40, marginBottom: 24 },
  addFirstBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.primary },
  addFirstBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  billCard: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  billThumb: { width: 60, height: 60, borderRadius: 6, backgroundColor: colors.inputBg },
  billInfo: { flex: 1, marginLeft: 12 },
  billDate: { fontSize: 15, fontWeight: '600', color: colors.text },
  billTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  billNotes: { fontSize: 12, color: colors.primary, marginTop: 4 },
});
