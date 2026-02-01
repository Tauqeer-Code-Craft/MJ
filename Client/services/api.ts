import axios from 'axios';
import { AuthResponse, DeployRequest, RedeployRequest, AppData } from '../types';

// In a real app, this would be an environment variable
const API_BASE_URL = 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor to inject token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('skydeploy_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Services
export const login = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await api.post('/login', { username, password });
  return response.data;
};

export const register = async (username: string, password: string, role: string): Promise<AuthResponse> => {
  const response = await api.post('/register', { username, password, role });
  return response.data;
};

// App Services
export const getApps = async (): Promise<AppData[]> => {
  const response = await api.get('/apps');
  return response.data;
};

export const getAppDetails = async (appName: string): Promise<AppData> => {
  const response = await api.get(`/apps/${appName}`);
  return response.data;
};

export const deployApp = async (data: DeployRequest): Promise<{ success: boolean; app: AppData }> => {
  const response = await api.post('/deploy', data);
  return response.data;
};

export const redeployApp = async (appName: string, data: RedeployRequest): Promise<{ success: boolean; app: AppData }> => {
  const response = await api.post(`/apps/${appName}/redeploy`, data);
  return response.data;
};

export const deleteApp = async (appName: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/apps/${appName}`);
  return response.data;
};

export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await api.get('/health');
    return response.data === "OK";
  } catch (error) {
    return false;
  }
};
