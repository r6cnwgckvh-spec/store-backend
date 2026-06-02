import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';

export default function ShoppingListDetailScreen({ route, navigation }) {
  const { id: listId, name: listName } = route.params || {};
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [category, setCategory] = useState('general');

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/shopping-lists/${listId}`);
      setList(data);
      setItems(data.items || []);
    } catch (e) { console.error(e); }
  }, [listId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const togglePurchased = async (item) => {
    try {
      await api.patch(`/shopping-lists/items/${item.id}`, { purchased: item.purchased ? 0 : 1 });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handleDelete = (item) => {
    Alert.alert('Remove Item', `Remove "${item.item_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.delete(`/shopping-lists/items/${item.id}`); load(); } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleAddItem = async () => {
    if (!itemName.trim()) return;
    try {
      await api.post(`/shopping-lists/${listId}/items`, {
        item_name: itemName.trim(),
        quantity: parseInt(quantity, 10) || 1,
        category: category === 'medicine' ? 'medicine' : undefined,
      });
      setItemName('');
      setQuantity('1');
      load();
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handlePrintPDF = async () => {
    try {
      const { html } = await api.get(`/shopping-lists/${listId}/pdf`);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const categoryIcon = (cat) => cat === 'medicine' ? '💊' : '📦';
  const categoryColor = (cat) => cat === 'medicine' ? '#dc3545' : '#6c757d';

  const renderItem = ({ item }) => (
    <View style={styles.itemRow}>
      <TouchableOpacity style={styles.checkbox} onPress={() => togglePurchased(item)}>
        {item.purchased ? (
          <Text style={styles.checked}>✓</Text>
        ) : (
          <View style={styles.unchecked} />
        )}
      </TouchableOpacity>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, item.purchased && styles.itemPurchased]}>
          {item.item_name}
        </Text>
        <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
      </View>
      <View style={[styles.catBadge, { backgroundColor: categoryColor(item.category) + '20' }]}>
        <Text style={styles.catText}>{categoryIcon(item.category)} {item.category || 'general'}</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
        <Text style={styles.deleteText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{listName || (list && list.name) || 'List'}</Text>
        <TouchableOpacity style={styles.pdfBtn} onPress={handlePrintPDF}>
          <Text style={styles.pdfBtnText}>PDF</Text>
        </TouchableOpacity>
      </View>

      {list && (
        <View style={styles.meta}>
          <Text style={styles.metaText}>Created: {formatDate(list.created_at)}</Text>
          {list.updated_at && <Text style={styles.metaText}>Modified: {formatDate(list.updated_at)}</Text>}
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={items.length === 0 ? { flex: 1, justifyContent: 'center' } : { padding: 16, paddingBottom: 120 }}
        ListEmptyComponent={<Text style={styles.empty}>No items yet</Text>}
        renderItem={renderItem}
      />

      <View style={styles.addSection}>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={itemName}
            onChangeText={setItemName}
            placeholder="Item name"
            placeholderTextColor={colors.textLight}
          />
          <TextInput
            style={styles.qtyInput}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Qty"
            placeholderTextColor={colors.textLight}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.addRow}>
          <TouchableOpacity
            style={[styles.catToggle, category === 'general' && styles.catActive]}
            onPress={() => setCategory('general')}
          >
            <Text style={[styles.catToggleText, category === 'general' && styles.catToggleActive]}>📦 General</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.catToggle, category === 'medicine' && styles.catActive]}
            onPress={() => setCategory('medicine')}
          >
            <Text style={[styles.catToggleText, category === 'medicine' && styles.catToggleActive]}>💊 Medicine</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={handleAddItem}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', marginHorizontal: 8 },
  pdfBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  pdfBtnText: { color: colors.card, fontSize: 13, fontWeight: '700' },
  meta: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.card },
  metaText: { fontSize: 11, color: colors.textLight, marginBottom: 2 },
  empty: { textAlign: 'center', color: colors.textLight, fontSize: 14 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 10, padding: 12, marginBottom: 8, elevation: 1,
  },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checked: { fontSize: 16, color: colors.primary, fontWeight: 'bold' },
  unchecked: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  itemPurchased: { textDecorationLine: 'line-through', color: colors.textLight },
  itemQty: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  catBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  catText: { fontSize: 10, fontWeight: '600' },
  deleteBtn: { marginLeft: 8, padding: 4 },
  deleteText: { fontSize: 18 },
  addSection: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    padding: 12, paddingBottom: 24,
  },
  addRow: { flexDirection: 'row', marginBottom: 8 },
  addInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, marginRight: 8, color: colors.text },
  qtyInput: { width: 60, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'center', color: colors.text },
  catToggle: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginRight: 8, backgroundColor: colors.background },
  catActive: { backgroundColor: colors.primary + '20' },
  catToggleText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  catToggleActive: { color: colors.primary },
  addBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  addBtnText: { color: colors.card, fontSize: 14, fontWeight: '700' },
});
