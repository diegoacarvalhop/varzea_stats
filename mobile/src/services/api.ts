import axios from 'axios';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
const baseURL = extra?.apiUrl ?? 'http://localhost:8080';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});
