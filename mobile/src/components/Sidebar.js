import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

const menuItems = [
  { icon: '🏠', label: 'Dashboard', screen: 'Home' },
  { icon: '📦', label: 'Products', screen: 'Products' },
  { icon: '🛒', label: 'Cart / Billing', screen: 'Cart' },
  { icon: '📋', label: 'Orders', screen: 'Orders' },
  { icon: '👥', label: 'Customers', screen: 'Customers' },
  { icon: '📊', label: 'Reports', screen: 'Reports' },
  { icon: '🏷️', label: 'Categories', screen: 'Categories' },
  { icon: '📋', label: 'Shopping Lists', screen: 'ShoppingLists' },
  { icon: '🧾', label: 'Add Multiple Items', screen: 'ScanBill' },
  { icon: '📄', label: 'My Bills', screen: 'Bills' },
  { icon: '📷', label: 'Scan Barcode', screen: 'Scanner', params: {} },
  { icon: '⚙️', label: 'Settings', screen: 'Settings' },
  { icon: '👑', label: 'Admin Panel', screen: 'AdminPanel' },
];

const getStyles = (colors) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay, zIndex: 999 },
  sidebar: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH,
    backgroundColor: colors.card, zIndex: 1000, elevation: 10, shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: colors.headerBg,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.headerText },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 20, color: colors.headerText },
  menu: { flex: 1, padding: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 8,
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  watermark: { fontSize: 11, color: colors.textLight },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
});

export default function Sidebar({ visible, onClose, navigationRef }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handlePress = (item) => {
    const nav = navigationRef?.current;
    if (!nav) return;
    onClose();
    setTimeout(() => {
      if (item.screen === 'Scanner') {
        nav.navigate('Scanner', { mode: 'sell' });
      } else if (['Products', 'Cart', 'Orders', 'Customers'].includes(item.screen)) {
        nav.navigate('Main', { screen: item.screen });
      } else if (item.screen === 'AdminPanel') {
        Linking.openURL('https://store-backend-npao.onrender.com/admin/');
      } else {
        nav.navigate(item.screen);
      }
    }, 250);
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Store Manager</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
            {menuItems.map((item) => (
              <TouchableOpacity key={item.screen} style={styles.menuItem} onPress={() => handlePress(item)}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Text style={styles.watermark}>Made by Kishan ❤️</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
