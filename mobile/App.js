import React, { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, Platform } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import PendingScreen from './src/screens/PendingScreen';
import SetPinScreen from './src/screens/SetPinScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import AddProductScreen from './src/screens/AddProductScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import CartScreen from './src/screens/CartScreen';
import OrderHistoryScreen from './src/screens/OrderHistoryScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import CustomerFormScreen from './src/screens/CustomerFormScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import Sidebar from './src/components/Sidebar';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export const SidebarContext = React.createContext();

function TabIcon({ label, focused }) {
  const icons = { Home: '🏠', Products: '📦', Cart: '🛒', Orders: '📋', Customers: '👥' };
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icons[label] || '📄'}</Text>;
}

function ProductsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProductsList" component={ProductsScreen} />
      <Stack.Screen name="AddProduct" component={AddProductScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </Stack.Navigator>
  );
}

function CartStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CartMain" component={CartScreen} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrdersList" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </Stack.Navigator>
  );
}

function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomersList" component={CustomersScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <Stack.Screen name="CustomerForm" component={CustomerFormScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0',
          paddingBottom: Platform.OS === 'ios' ? 20 : 4, paddingTop: 4, height: Platform.OS === 'ios' ? 80 : 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Products" component={ProductsStack} />
      <Tab.Screen name="Cart" component={CartStack} />
      <Tab.Screen name="Orders" component={OrdersStack}
        listeners={({ navigation }) => ({
          tabPress: () => { navigation.navigate('Orders', { screen: 'OrdersList' }); },
        })}
      />
      <Tab.Screen name="Customers" component={CustomersStack} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { token, loading, user } = useAuth();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const navigationRef = useRef(null);

  const [authView, setAuthView] = useState('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [setupToken, setSetupToken] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('https://store-backend-npao.onrender.com/api/health').catch(() => {});
    }, 300000);
    fetch('https://store-backend-npao.onrender.com/api/health').catch(() => {});
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 16 }}>Loading...</Text>
    </View>;
  }

  if (token && user) {
    if (user.status === 'approved' && !user.has_pin) {
      return <SetPinScreen />;
    }
    return (
      <SidebarContext.Provider value={{
        sidebarVisible,
        toggleSidebar: () => setSidebarVisible(v => !v),
        openSidebar: () => setSidebarVisible(true),
      }}>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="dark" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Scanner" component={ScannerScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="Categories" component={CategoriesScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        <Sidebar
          visible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
          navigation={navigationRef.current}
        />
      </SidebarContext.Provider>
    );
  }

  if (authView === 'setpin') {
    return <SetPinScreen setupToken={setupToken} />;
  }

  if (authView === 'pending') {
    return <PendingScreen
      email={pendingEmail}
      onApproved={(st) => { setSetupToken(st); setAuthView('setpin'); }}
      onRejected={(msg) => alert(msg)}
      onBack={() => setAuthView('login')}
    />;
  }

  if (authView === 'register') {
    return <RegisterScreen
      onBack={() => setAuthView('login')}
      onPending={(email) => { setPendingEmail(email); setAuthView('pending'); }}
      onSetPin={() => setAuthView('setpin')}
    />;
  }

  return <LoginScreen
    onRegister={() => setAuthView('register')}
    onLoginDone={() => {}}
  />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
