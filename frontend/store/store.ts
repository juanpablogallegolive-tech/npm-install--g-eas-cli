import { create } from 'zustand';
import { Producto, Flujo, Calculo, Cotizacion } from '../types/types';

interface AppState {
  productos: Producto[];
  flujos: Flujo[];
  calculos: Calculo[];
  cotizaciones: Cotizacion[];
  loading: boolean;
  
  setProductos: (productos: Producto[]) => void;
  setFlujos: (flujos: Flujo[]) => void;
  setCalculos: (calculos: Calculo[]) => void;
  setCotizaciones: (cotizaciones: Cotizacion[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  productos: [],
  flujos: [],
  calculos: [],
  cotizaciones: [],
  loading: false,
  
  setProductos: (productos) => set({ productos }),
  setFlujos: (flujos) => set({ flujos }),
  setCalculos: (calculos) => set({ calculos }),
  setCotizaciones: (cotizaciones) => set({ cotizaciones }),
  setLoading: (loading) => set({ loading }),
}));
