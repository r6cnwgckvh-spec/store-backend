import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  TOKEN: 'store_token',
  PIN_HASH: 'store_pin_hash',
  USER: 'store_user',
  REGISTERED: 'store_registered',
  SETUP_DONE: 'store_setup_done',
};

// Web fallback using sessionStorage
const webStorage = {
  getItem: (key) => { try { return Promise.resolve(sessionStorage.getItem(key)); } catch { return Promise.resolve(null); } },
  setItem: (key, val) => { try { sessionStorage.setItem(key, val); } catch {} return Promise.resolve(); },
  removeItem: (key) => { try { sessionStorage.removeItem(key); } catch {} return Promise.resolve(); },
};

function store() {
  if (Platform.OS === 'web') return webStorage;
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, val) => SecureStore.setItemAsync(key, val),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

export async function getToken() { return store().getItem(KEYS.TOKEN); }
export async function setToken(token) {
  if (token) return store().setItem(KEYS.TOKEN, token);
  return store().removeItem(KEYS.TOKEN);
}
export async function clearToken() { return store().removeItem(KEYS.TOKEN); }

export async function getPinHash() { return store().getItem(KEYS.PIN_HASH); }
export async function setPinHash(hash) { return store().setItem(KEYS.PIN_HASH, hash); }
export async function clearPinHash() { return store().removeItem(KEYS.PIN_HASH); }

export async function getUser() {
  const data = await store().getItem(KEYS.USER);
  return data ? JSON.parse(data) : null;
}
export async function setUser(user) { return store().setItem(KEYS.USER, JSON.stringify(user)); }
export async function clearUser() { return store().removeItem(KEYS.USER); }

export async function isRegistered() {
  const val = await store().getItem(KEYS.REGISTERED);
  return val === 'true';
}
export async function setRegistered(val) { return store().setItem(KEYS.REGISTERED, val ? 'true' : 'false'); }

export async function isSetupDone() {
  const val = await store().getItem(KEYS.SETUP_DONE);
  return val === 'true';
}
export async function setSetupDone(val) {
  return store().setItem(KEYS.SETUP_DONE, val ? 'true' : 'false');
}

export async function clearAll() {
  await Promise.all([
    store().removeItem(KEYS.TOKEN),
    store().removeItem(KEYS.PIN_HASH),
    store().removeItem(KEYS.USER),
    store().removeItem(KEYS.REGISTERED),
    store().removeItem(KEYS.SETUP_DONE),
  ]);
}
