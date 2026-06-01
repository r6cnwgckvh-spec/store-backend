import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, SafeAreaView, Linking } from 'react-native';

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
  { icon: '📷', label: 'Scan Barcode', screen: 'Scanner', params: {} },
  { icon: '⚙️', label: 'Settings', screen: 'Settings' },
  { icon: '👑', label: 'Admin Panel', screen: 'AdminPanel' },
];

export default function Sidebar({ visible, onClose, navigation }) {
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
    onClose();
    setTimeout(() => {
      if (item.screen === 'Scanner') {
        navigation.navigate('Scanner', { mode: 'sell' });
      } else if (['Products', 'Cart', 'Orders', 'Customers'].includes(item.screen)) {
        navigation.navigate('Main', { screen: item.screen });
      } else if (item.screen === 'AdminPanel') {
        Linking.openURL('https://store-backend-npao.onrender.com/admin/');
      } else {
        navigation.navigate(item.screen);
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
          <View style={styles.menu}>
            {menuItems.map((item) => (
              <TouchableOpacity key={item.screen} style={styles.menuItem} onPress={() => handlePress(item)}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.footer}>
            <Text style={styles.watermark}>Made by Kishan ❤️</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 },
  sidebar: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH,
    backgroundColor: '#fff', zIndex: 1000, elevation: 10, shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#1a1a2e',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 20, color: '#fff' },
  menu: { flex: 1, padding: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 8,
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e0e0e0', alignItems: 'center' },
  watermark: { fontSize: 11, color: '#999' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 8 },
});
