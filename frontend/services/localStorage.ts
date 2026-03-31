import AsyncStorage from '@react-native-async-storage/async-storage';
import { Producto, Flujo, Calculo, Cotizacion } from '../types/types';

const KEYS = {
  PRODUCTOS: '@calculadora_productos',
  FLUJOS: '@calculadora_flujos',
  CALCULOS: '@calculadora_calculos',
  COTIZACIONES: '@calculadora_cotizaciones',
};

// Generar ID único
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// ============ PRODUCTOS ============
export const localProductosApi = {
  getAll: async (): Promise<Producto[]> => {
    try {
      const data = await AsyncStorage.getItem(KEYS.PRODUCTOS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  search: async (query: string): Promise<Producto[]> => {
    const productos = await localProductosApi.getAll();
    const q = query.toLowerCase();
    return productos.filter(p => p.nombre.toLowerCase().includes(q));
  },

  create: async (producto: Omit<Producto, '_id'>): Promise<Producto> => {
    const productos = await localProductosApi.getAll();
    const newProducto = { ...producto, _id: generateId() };
    productos.push(newProducto);
    await AsyncStorage.setItem(KEYS.PRODUCTOS, JSON.stringify(productos));
    return newProducto;
  },

  update: async (id: string, data: Partial<Producto>): Promise<void> => {
    const productos = await localProductosApi.getAll();
    const index = productos.findIndex(p => p._id === id);
    if (index !== -1) {
      productos[index] = { ...productos[index], ...data };
      await AsyncStorage.setItem(KEYS.PRODUCTOS, JSON.stringify(productos));
    }
  },

  delete: async (id: string): Promise<void> => {
    const productos = await localProductosApi.getAll();
    const filtered = productos.filter(p => p._id !== id);
    await AsyncStorage.setItem(KEYS.PRODUCTOS, JSON.stringify(filtered));
  },

  importar: async (productos: Producto[]): Promise<void> => {
    await AsyncStorage.setItem(KEYS.PRODUCTOS, JSON.stringify(productos));
  },
};

// ============ FLUJOS ============
export const localFlujosApi = {
  getAll: async (): Promise<Flujo[]> => {
    try {
      const data = await AsyncStorage.getItem(KEYS.FLUJOS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  create: async (flujo: Omit<Flujo, '_id'>): Promise<Flujo> => {
    const flujos = await localFlujosApi.getAll();
    const newFlujo = { ...flujo, _id: generateId() };
    flujos.push(newFlujo);
    await AsyncStorage.setItem(KEYS.FLUJOS, JSON.stringify(flujos));
    return newFlujo;
  },

  update: async (id: string, data: Partial<Flujo>): Promise<void> => {
    const flujos = await localFlujosApi.getAll();
    const index = flujos.findIndex(f => f._id === id);
    if (index !== -1) {
      flujos[index] = { ...flujos[index], ...data };
      await AsyncStorage.setItem(KEYS.FLUJOS, JSON.stringify(flujos));
    }
  },

  delete: async (id: string): Promise<void> => {
    const flujos = await localFlujosApi.getAll();
    const filtered = flujos.filter(f => f._id !== id);
    await AsyncStorage.setItem(KEYS.FLUJOS, JSON.stringify(filtered));
  },

  importar: async (flujos: Flujo[]): Promise<void> => {
    await AsyncStorage.setItem(KEYS.FLUJOS, JSON.stringify(flujos));
  },
};

// ============ CALCULOS (Historial) ============
export const localCalculosApi = {
  getAll: async (): Promise<Calculo[]> => {
    try {
      const data = await AsyncStorage.getItem(KEYS.CALCULOS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  create: async (calculo: Omit<Calculo, '_id'>): Promise<Calculo> => {
    const calculos = await localCalculosApi.getAll();
    const newCalculo = { ...calculo, _id: generateId(), fecha: new Date().toISOString() };
    calculos.unshift(newCalculo); // Agregar al inicio
    await AsyncStorage.setItem(KEYS.CALCULOS, JSON.stringify(calculos));
    return newCalculo;
  },

  delete: async (id: string): Promise<void> => {
    const calculos = await localCalculosApi.getAll();
    const filtered = calculos.filter(c => c._id !== id);
    await AsyncStorage.setItem(KEYS.CALCULOS, JSON.stringify(filtered));
  },

  importar: async (calculos: Calculo[]): Promise<void> => {
    await AsyncStorage.setItem(KEYS.CALCULOS, JSON.stringify(calculos));
  },
};

// ============ COTIZACIONES ============
export const localCotizacionesApi = {
  getAll: async (): Promise<Cotizacion[]> => {
    try {
      const data = await AsyncStorage.getItem(KEYS.COTIZACIONES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  create: async (cotizacion: Omit<Cotizacion, '_id'>): Promise<Cotizacion> => {
    const cotizaciones = await localCotizacionesApi.getAll();
    const newCotizacion = { ...cotizacion, _id: generateId(), fecha: new Date().toISOString() };
    cotizaciones.unshift(newCotizacion);
    await AsyncStorage.setItem(KEYS.COTIZACIONES, JSON.stringify(cotizaciones));
    return newCotizacion;
  },

  update: async (id: string, data: Partial<Cotizacion>): Promise<void> => {
    const cotizaciones = await localCotizacionesApi.getAll();
    const index = cotizaciones.findIndex(c => c._id === id);
    if (index !== -1) {
      cotizaciones[index] = { ...cotizaciones[index], ...data };
      await AsyncStorage.setItem(KEYS.COTIZACIONES, JSON.stringify(cotizaciones));
    }
  },

  delete: async (id: string): Promise<void> => {
    const cotizaciones = await localCotizacionesApi.getAll();
    const filtered = cotizaciones.filter(c => c._id !== id);
    await AsyncStorage.setItem(KEYS.COTIZACIONES, JSON.stringify(filtered));
  },

  importar: async (cotizaciones: Cotizacion[]): Promise<void> => {
    await AsyncStorage.setItem(KEYS.COTIZACIONES, JSON.stringify(cotizaciones));
  },
};

// ============ UTILIDADES ============
export const localStorageUtils = {
  // Limpiar todos los datos
  clearAll: async (): Promise<void> => {
    await AsyncStorage.multiRemove([KEYS.PRODUCTOS, KEYS.FLUJOS, KEYS.CALCULOS, KEYS.COTIZACIONES]);
  },

  // Exportar todos los datos
  exportAll: async () => {
    return {
      productos: await localProductosApi.getAll(),
      flujos: await localFlujosApi.getAll(),
      calculos: await localCalculosApi.getAll(),
      cotizaciones: await localCotizacionesApi.getAll(),
    };
  },

  // Importar todos los datos
  importAll: async (data: {
    productos?: Producto[];
    flujos?: Flujo[];
    calculos?: Calculo[];
    cotizaciones?: Cotizacion[];
  }): Promise<void> => {
    if (data.productos) await localProductosApi.importar(data.productos);
    if (data.flujos) await localFlujosApi.importar(data.flujos);
    if (data.calculos) await localCalculosApi.importar(data.calculos);
    if (data.cotizaciones) await localCotizacionesApi.importar(data.cotizaciones);
  },
};
