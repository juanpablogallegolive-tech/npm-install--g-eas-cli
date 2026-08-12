import axios from 'axios';
import { Producto, Flujo, Calculo, Cotizacion, Cliente, MatchProductoResult, StatsSistema } from '../types/types';

// CORREGIDO: Sin fallback hardcodeado
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error('EXPO_PUBLIC_BACKEND_URL no está configurado');
}

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Productos
export const productosApi = {
  getAll: (categoria?: string) => api.get<Producto[]>('/productos', { params: { categoria } }),
  search: (query: string) => api.get<Producto[]>(`/productos/buscar?q=${query}`),
  getById: (id: string) => api.get<Producto>(`/productos/${id}`),
  create: (data: Omit<Producto, '_id'>) => api.post<Producto>('/productos', data),
  update: (id: string, data: Partial<Producto>) => api.put(`/productos/${id}`, data),
  delete: (id: string) => api.delete(`/productos/${id}`),
  deleteAll: () => api.delete('/productos'),
  deleteMultiple: (ids: string[]) => api.post('/productos/eliminar-multiples', { ids }),
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
  getHtmlUrl: (id: string) => `${BACKEND_URL}/api/cotizaciones/${id}/html`,
};

// Estadísticas del sistema
export const statsApi = {
  get: () => api.get<StatsSistema>('/stats'),
};

// Calcular precio
export const calcularPrecio = (data: {
  costo_base: number;
  flujo_id: string;
  valores_operaciones: Record<string, number>;
  clientes: Array<{ nombre: string; porcentaje_ganancia: number; comentario?: string }>;
}) => api.post<{ costo_base: number; precio_calculado: number; resultados: Cliente[] }>('/calcular', data);

// Match de productos
export const matchProductos = (nombres: string[]) => 
  api.post<MatchProductoResult[]>('/match-productos', { nombres });

// Aprendizaje de IA
export const aprendizajesApi = {
  guardar: (data: {
    nombre_original: string;
    producto_id_correcto: string;
    nombre_producto_correcto: string;
  }) => api.post('/aprender', data),
  getAll: () => api.get<Array<{
    _id: string;
    nombre_original: string;
    nombre_normalizado: string;
    aliases: string[];
    aliases_normalizados: string[];
    producto_id: string;
    nombre_producto: string;
    veces_corregido: number;
  }>>('/aprendizajes'),
  delete: (id: string) => api.delete(`/aprendizajes/${id}`),
};

// Alias legacy para compatibilidad con LectorTexto
export const guardarAprendizaje = aprendizajesApi.guardar;

export default api;
