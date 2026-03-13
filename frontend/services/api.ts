import axios from 'axios';
import Constants from 'expo-constants';
import { Producto, Flujo, Calculo, Cotizacion, Cliente } from '../types/types';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Productos
export const productosApi = {
  getAll: () => api.get<Producto[]>('/productos'),
  search: (query: string) => api.get<Producto[]>(`/productos/buscar?q=${query}`),
  getById: (id: string) => api.get<Producto>(`/productos/${id}`),
  create: (data: Omit<Producto, '_id'>) => api.post<Producto>('/productos', data),
  update: (id: string, data: Partial<Producto>) => api.put(`/productos/${id}`, data),
  delete: (id: string) => api.delete(`/productos/${id}`),
};

// Flujos
export const flujosApi = {
  getAll: () => api.get<Flujo[]>('/flujos'),
  getById: (id: string) => api.get<Flujo>(`/flujos/${id}`),
  create: (data: Omit<Flujo, '_id'>) => api.post<Flujo>('/flujos', data),
  update: (id: string, data: Partial<Flujo>) => api.put(`/flujos/${id}`, data),
  delete: (id: string) => api.delete(`/flujos/${id}`),
};

// Cálculos
export const calculosApi = {
  getAll: (params?: { nombre?: string; fecha_desde?: string; fecha_hasta?: string }) => 
    api.get<Calculo[]>('/calculos', { params }),
  getById: (id: string) => api.get<Calculo>(`/calculos/${id}`),
  create: (data: Omit<Calculo, '_id'>) => api.post<Calculo>('/calculos', data),
  delete: (id: string) => api.delete(`/calculos/${id}`),
};

// Cotizaciones
export const cotizacionesApi = {
  getAll: () => api.get<Cotizacion[]>('/cotizaciones'),
  getById: (id: string) => api.get<Cotizacion>(`/cotizaciones/${id}`),
  create: (data: Omit<Cotizacion, '_id'>) => api.post<Cotizacion>('/cotizaciones', data),
  update: (id: string, data: Partial<Cotizacion>) => api.put(`/cotizaciones/${id}`, data),
  delete: (id: string) => api.delete(`/cotizaciones/${id}`),
};

// Calcular precio
export const calcularPrecio = (data: {
  costo_base: number;
  flujo_id: string;
  valores_operaciones: Record<string, number>;
  clientes: Array<{ nombre: string; porcentaje_ganancia: number; comentario?: string }>;
}) => api.post<{ costo_base: number; resultados: Cliente[] }>('/calcular', data);

export default api;
