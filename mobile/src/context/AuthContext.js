import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setOnUnauthorized } from '../api';
import * as storage from '../services/storage';
import { sha256 } from '../utils/helpers';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasLocalPin, setHasLocalPin] = useState(false);
  const [locked, setLocked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  const isLocked = !!(token && hasLocalPin && locked);

  const unlock = useCallback(() => {
    setLocked(false);
  }, []);

  const completeSetup = useCallback(async () => {
    await storage.setSetupDone(true);
    setNeedsSetup(false);
  }, []);

  const logout = useCallback(async () => {
    await storage.clearAll();
    setUser(null);
    setToken(null);
    setHasLocalPin(false);
    setLocked(false);
    setNeedsSetup(false);
  }, []);

  const checkStoredAuth = useCallback(async () => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    try {
      const storedPinHash = await storage.getPinHash();
      setHasLocalPin(!!storedPinHash);

      const storedToken = await storage.getToken();
      if (!storedToken) { clearTimeout(timeout); setLoading(false); return; }

      const storedUser = await storage.getUser();
      try {
        const freshUser = await api.get('/auth/me');
        setUser(freshUser);
        setToken(storedToken);
        await storage.setUser(freshUser);
      } catch {
        if (storedUser && storedPinHash) {
          setUser(storedUser);
          setToken(storedToken);
        }
      }

      if (storedPinHash) {
        setLocked(true);
      }

      const setupDone = await storage.isSetupDone();
      setNeedsSetup(!setupDone);
    } catch (e) {
      console.warn('checkStoredAuth error:', e);
    }
    clearTimeout(timeout);
    setLoading(false);
  }, []);

  useEffect(() => {
    setOnUnauthorized(logout);
    checkStoredAuth();
  }, []);

  const register = async (name, email) => {
    const data = await api.post('/auth/register', { name, email });
    await storage.setUser(data.user);
    if (data.token) {
      await storage.setToken(data.token);
      setToken(data.token);
    }
    if (data.setupToken) {
      await storage.setToken(data.setupToken);
      setToken(data.setupToken);
    }
    return data;
  };

  const checkStatus = async (email) => {
    return api.post('/auth/check-status', { email });
  };

  const setPin = async (pin, setupToken) => {
    const data = await (setupToken
      ? api.postWithToken('/auth/set-pin', { pin }, setupToken)
      : api.post('/auth/set-pin', { pin }));
    const hash = await sha256(pin);
    await storage.setPinHash(hash);
    await storage.setToken(data.token);
    await storage.setUser(data.user);
    setToken(data.token);
    setUser(data.user);
    setHasLocalPin(true);
    setLocked(true);
    const setupDone = await storage.isSetupDone();
    setNeedsSetup(!setupDone);
    return data;
  };

  const login = async (email, pin) => {
    const data = await api.post('/auth/login', { email, pin });
    const hash = await sha256(pin);
    await storage.setPinHash(hash);
    await storage.setToken(data.token);
    await storage.setUser(data.user);
    setToken(data.token);
    setUser(data.user);
    setHasLocalPin(true);
    setLocked(true);
    const setupDone = await storage.isSetupDone();
    setNeedsSetup(!setupDone);
    return data;
  };

  const loginWithPin = async (pin) => {
    const storedHash = await storage.getPinHash();
    if (!storedHash) throw new Error('No PIN set up');
    const inputHash = await sha256(pin);
    if (inputHash !== storedHash) throw new Error('Wrong PIN');

    const storedToken = await storage.getToken();
    const storedUser = await storage.getUser();
    if (!storedToken || !storedUser) throw new Error('Session expired');

    setToken(storedToken);
    setUser(storedUser);
    setLocked(true);
    const setupDone = await storage.isSetupDone();
    setNeedsSetup(!setupDone);
    return storedUser;
  };

  const changePin = async (oldPin, newPin) => {
    const data = await api.post('/auth/change-pin', { oldPin, newPin });
    const hash = await sha256(newPin);
    await storage.setPinHash(hash);
    await storage.setToken(data.token);
    setToken(data.token);
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading, hasLocalPin, locked, isLocked, needsSetup,
      login, loginWithPin, register, checkStatus, setPin, changePin, logout,
      unlock, completeSetup,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
