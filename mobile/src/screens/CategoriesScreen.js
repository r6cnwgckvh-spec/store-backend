import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, SafeAreaView, Platform,
} from 'react-native';
import { api } from '../api';

const COLORS = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6610f2'];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

export default function CategoriesScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#007bff');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try { setCategories(await api.getCategories()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Enter a name');
    try {
      if (editing) {
        await api.updateCategory(editing, { name: name.trim(), color });
      } else {
        await api.createCategory({ name: name.trim(), color });
      }
      setName(''); setColor(randomColor()); setEditing(null); setShowForm(false);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handleEdit = (cat) => {
    setName(cat.name);
    setColor(cat.color);
    setEditing(cat.id);
    setShowForm(true);
  };

  const handleDelete = (cat) => {
    Alert.alert('Delete Category', `Delete "${cat.name}"? Products will lose this category.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteCategory(cat.id); load(); } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity onPress={() => { setShowForm(true); setEditing(null); setName(''); setColor(randomColor()); }}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Category name" placeholderTextColor="#999" autoFocus />
          <View style={styles.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorActive]} onPress={() => setColor(c)} />
            ))}
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={submit}>
              <Text style={styles.saveText}>{editing ? 'Update' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={categories}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={categories.length === 0 ? { flex: 1, justifyContent: 'center' } : { padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No categories yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={[styles.catColor, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardCount}>{item.product_count || 0} products</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editBtn}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.delBtn}>
                <Text style={styles.delText}>Del</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backBtn: { fontSize: 16, color: '#007bff', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  addBtn: { fontSize: 16, color: '#007bff', fontWeight: '700' },
  formCard: { backgroundColor: '#fff', margin: 16, borderRadius: 10, padding: 16, elevation: 2 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorActive: { borderWidth: 3, borderColor: '#1a1a2e' },
  formActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f0f2f5' },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#666' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#007bff' },
  saveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  empty: { textAlign: 'center', color: '#999', fontSize: 14 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  catColor: { width: 14, height: 14, borderRadius: 7 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#333' },
  cardCount: { fontSize: 11, color: '#999', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 6 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#e8f4ff' },
  editText: { fontSize: 12, fontWeight: '600', color: '#007bff' },
  delBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#ffe8e8' },
  delText: { fontSize: 12, fontWeight: '600', color: '#dc3545' },
});
