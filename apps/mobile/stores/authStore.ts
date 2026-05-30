import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api, { TOKEN_KEYS } from '../lib/api';

export interface User { id: string; name: string; email: string; role: 'admin' | 'user'; }

interface AuthState {
  user: User | null; isAuthenticated: boolean; isLoading: boolean;
  login:           (email: string, password: string) => Promise<void>;
  register:        (name: string, email: string, password: string) => Promise<void>;
  logout:          () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, isAuthenticated: false, isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user, accessToken, refreshToken } = data.data;
    await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS,  accessToken);
    await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refreshToken);
    await SecureStore.setItemAsync(TOKEN_KEYS.USER,    JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  register: async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    const { user, accessToken, refreshToken } = data.data;
    await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS,  accessToken);
    await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refreshToken);
    await SecureStore.setItemAsync(TOKEN_KEYS.USER,    JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);
      if (refreshToken) await api.delete('/auth/logout', { data: { refreshToken } });
    } catch {}
    await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS);
    await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH);
    await SecureStore.deleteItemAsync(TOKEN_KEYS.USER);
    set({ user: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const userJson = await SecureStore.getItemAsync(TOKEN_KEYS.USER);
      const token    = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
      if (userJson && token) set({ user: JSON.parse(userJson), isAuthenticated: true });
    } catch {} finally { set({ isLoading: false }); }
  },
}));
