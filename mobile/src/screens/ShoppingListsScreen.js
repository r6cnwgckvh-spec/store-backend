import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Alert, Modal, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';

export default function ShoppingListsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [lists, setLists] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try { setLists(await api.get('/shopping-lists')); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await api.post('/shopping-lists', { name: newName.trim() });
      setNewName('');
      setShowModal(false);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const promptCreate = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt('New Shopping List', 'Enter list name:', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create', onPress: async (name) => {
          if (!name?.trim()) return;
          try { await api.post('/shopping-lists', { name: name.trim() }); load(); } catch (e) { Alert.alert('Error', e.message); }
        }},
      ], 'plain-text');
    } else {
      setNewName('');
      setShowModal(true);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ShoppingListDetail', { id: item.id, name: item.name })}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardCount}>{item.item_count || 0} items</Text>
        <Text style={styles.cardDate}>Created: {formatDate(item.created_at)}</Text>
        {item.updated_at && (
          <Text style={styles.cardDate}>Modified: {formatDate(item.updated_at)}</Text>
        )}
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Shopping Lists</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={lists}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={lists.length === 0 ? { flex: 1, justifyContent: 'center' } : { padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No shopping lists yet{'\n'}Tap + to create one</Text>}
        renderItem={renderItem}
      />

      <TouchableOpacity style={styles.fab} onPress={promptCreate}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Shopping List</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="List name"
              placeholderTextColor={colors.textLight}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
                <Text style={styles.saveText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', color: colors.textLight, fontSize: 14, lineHeight: 22 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1,
  },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  cardCount: { fontSize: 12, color: colors.primary, marginTop: 3 },
  cardDate: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  arrow: { fontSize: 24, color: colors.textLight, marginLeft: 8 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.card, borderRadius: 12, padding: 20, width: '80%', elevation: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 14, color: colors.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.background },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary },
  saveText: { fontSize: 14, fontWeight: '600', color: colors.card },
});
