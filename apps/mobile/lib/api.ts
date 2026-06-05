import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// Ganti IP sesuai komputer kamu
const BASE_URL = 'https://rpl-kelompok-12.onrender.com/api';

export const TOKEN_KEYS = {
  ACCESS:  'ecosmart_access_token',
  REFRESH: 'ecosmart_refresh_token',
  USER:    'ecosmart_user',
} as const;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => { if (error) p.reject(error); else p.resolve(token!); });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const orig = error.config;
    if (error.response?.status === 401 && !orig._retry && !orig.url?.includes('/auth/refresh') && !orig.url?.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => { failedQueue.push({ resolve, reject }); })
          .then((token) => { orig.headers.Authorization = `Bearer ${token}`; return api(orig); });
      }
      orig._retry   = true;
      isRefreshing  = true;
      try {
        const refreshToken = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS,  data.data.accessToken);
        await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, data.data.refreshToken);
        processQueue(null, data.data.accessToken);
        orig.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(orig);
      } catch (e) {
        processQueue(e, null);
        await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS);
        await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH);
        await SecureStore.deleteItemAsync(TOKEN_KEYS.USER);
        return Promise.reject(e);
      } finally { isRefreshing = false; }
    }
    return Promise.reject(error);
  }
);

export default api;
