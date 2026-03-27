import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  ActivityIndicator,
  Divider,
  List,
  ProgressBar,
  Snackbar,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { productosApi, calculosApi, flujosApi } from '../services/api';

export default function ImportExportScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  
  const [exportResult, setExportResult] = useState<{ total: number } | null>(null);
  const [importResults, setImportResults] = useState<{
    nuevos: number; 
    actualizados: number; 
    sinCambios: number;
    errores: number;
  } | null>(null);

  const showSnack = (msg: string) => {
    setSnackMessage(msg);
    setSnackVisible(true);
  };

  // Crear archivo Excel con columnas separadas
  const createExcelFile = (productos: any[]): string => {
    // Crear datos para el Excel con columnas separadas
    const data = productos.map((p) => ({
      'Nombre': String(p.nombre || ''),
      'Costo_Original': p.costo_original || 0,
      'Costo_Base': p.costo_base || 0,
      'Comentarios': String(p.comentarios || ''),
    }));

    // Crear workbook y worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 40 }, // Nombre
      { wch: 15 }, // Costo_Original
      { wch: 15 }, // Costo_Base
      { wch: 30 }, // Comentarios
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Generar como base64
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    return wbout;
  };

  // ========== EXPORTAR ==========
  const exportarDatos = async () => {
    setLoading(true);
    setProgress(0);
    setStatus('Cargando datos...');
    setExportResult(null);
    
    try {
      // Cargar todos los datos
      const [productosRes, historialRes, flujosRes] = await Promise.all([
        productosApi.getAll(),
        calculosApi.getAll(),
        flujosApi.getAll(),
      ]);
      
      const productos = productosRes.data || [];
      const historial = historialRes.data || [];
      const flujos = flujosRes.data || [];

      setProgress(0.3);
      setStatus('Preparando Excel...');

      const wb = XLSX.utils.book_new();

      // HOJA 1: Productos
      let productosData: any[];
      if (productos.length === 0) {
        productosData = [{
          'Nombre': 'PRODUCTO EJEMPLO (borrar)',
          'Costo_Original': 1000,
          'Costo_Base': 1200,
          'Comentarios': 'Ejemplo',
        }];
      } else {
        productosData = productos.map((p: any) => ({
          'Nombre': String(p.nombre || ''),
          'Costo_Original': p.costo_original || 0,
          'Costo_Base': p.costo_base || 0,
          'Comentarios': String(p.comentarios || ''),
        }));
      }
      const wsProductos = XLSX.utils.json_to_sheet(productosData);
      wsProductos['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos');

      setProgress(0.5);

      // HOJA 2: Historial
      let historialData: any[];
      if (historial.length === 0) {
        historialData = [{
          'Producto': 'EJEMPLO',
          'Flujo': 'Flujo ejemplo',
          'Costo_Base': 0,
          'Precio_Calculado': 0,
          'Cliente': 'Cliente ejemplo',
          'Ganancia_%': 0,
          'Precio_Final': 0,
          'Fecha': '',
        }];
      } else {
        historialData = [];
        historial.forEach((h: any) => {
          if (h.clientes && h.clientes.length > 0) {
            h.clientes.forEach((c: any) => {
              historialData.push({
                'Producto': h.nombre_producto || '',
                'Flujo': h.flujo_nombre || '',
                'Costo_Base': h.costo_base || 0,
                'Precio_Calculado': h.precio_calculado || 0,
                'Cliente': c.nombre || '',
                'Ganancia_%': c.porcentaje_ganancia || 0,
                'Precio_Final': c.precio_final || 0,
                'Fecha': h.fecha || '',
              });
            });
          } else {
            historialData.push({
              'Producto': h.nombre_producto || '',
              'Flujo': h.flujo_nombre || '',
              'Costo_Base': h.costo_base || 0,
              'Precio_Calculado': h.precio_calculado || 0,
              'Cliente': '',
              'Ganancia_%': 0,
              'Precio_Final': 0,
              'Fecha': h.fecha || '',
            });
          }
        });
      }
      const wsHistorial = XLSX.utils.json_to_sheet(historialData);
      wsHistorial['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial');

      setProgress(0.7);

      // HOJA 3: Flujos
      let flujosData: any[];
      if (flujos.length === 0) {
        flujosData = [{
          'Nombre_Flujo': 'FLUJO EJEMPLO',
          'Operacion': 'Operacion ejemplo',
          'Tipo_Operacion': 'suma',
          'Tipo_Valor': 'porcentaje',
        }];
      } else {
        flujosData = [];
        flujos.forEach((f: any) => {
          if (f.operaciones && f.operaciones.length > 0) {
            f.operaciones.forEach((op: any) => {
              flujosData.push({
                'Nombre_Flujo': f.nombre || '',
                'Operacion': op.nombre || '',
                'Tipo_Operacion': op.tipo_operacion || '',
                'Tipo_Valor': op.tipo_valor || '',
              });
            });
          } else {
            flujosData.push({
              'Nombre_Flujo': f.nombre || '',
              'Operacion': '',
              'Tipo_Operacion': '',
              'Tipo_Valor': '',
            });
          }
        });
      }
      const wsFlujos = XLSX.utils.json_to_sheet(flujosData);
      wsFlujos['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsFlujos, 'Flujos');

      setProgress(0.8);

      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `datos_completos_${Date.now()}.xlsx`;

      if (Platform.OS === 'web') {
        const binary = atob(excelBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setExportResult({ total: productos.length });
        showSnack('Datos exportados');
      } else {
        setStatus('Guardando archivo...');
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, excelBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setProgress(0.95);
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Guardar datos',
          });
          setExportResult({ total: productos.length });
          showSnack(`Exportado: ${productos.length} productos, ${historial.length} cálculos, ${flujos.length} flujos`);
        }
      }

      setProgress(1);
      
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'No se pudo exportar');
    } finally {
      setLoading(false);
      setStatus('');
      setProgress(0);
    }
  };

  // ========== IMPORTAR ==========
  const importarDatos = async () => {
    setLoading(true);
    setProgress(0);
    setStatus('Selecciona archivo...');
    setImportResults(null);
    setExportResult(null);

    try {
      // 1. Seleccionar archivo
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          '*/*'
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const fileName = file.name || '';
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      
      setStatus('Leyendo archivo...');
      setProgress(0.2);

      let productos: { nombre: string; costo_original: number; costo_base: number }[] = [];

      if (isExcel) {
        // Leer archivo Excel
        let fileContent: string;
        
        if (Platform.OS === 'web') {
          const response = await fetch(file.uri);
          const arrayBuffer = await response.arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          
          productos = jsonData.map((row: any) => ({
            nombre: String(row['Nombre'] || row['nombre'] || row['NOMBRE'] || '').trim(),
            costo_original: parseFloat(row['Costo_Original'] || row['costo_original'] || row['COSTO_ORIGINAL'] || 0) || 0,
            costo_base: parseFloat(row['Costo_Base'] || row['costo_base'] || row['COSTO_BASE'] || row['Precio'] || 0) || 0,
          }));
        } else {
          fileContent = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const wb = XLSX.read(fileContent, { type: 'base64' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          
          productos = jsonData.map((row: any) => ({
            nombre: String(row['Nombre'] || row['nombre'] || row['NOMBRE'] || '').trim(),
            costo_original: parseFloat(row['Costo_Original'] || row['costo_original'] || row['COSTO_ORIGINAL'] || 0) || 0,
            costo_base: parseFloat(row['Costo_Base'] || row['costo_base'] || row['COSTO_BASE'] || row['Precio'] || 0) || 0,
          }));
        }
      } else {
        // Leer CSV (mantener compatibilidad)
        let content: string;
        
        if (Platform.OS === 'web') {
          const response = await fetch(file.uri);
          content = await response.text();
        } else {
          content = await FileSystem.readAsStringAsync(file.uri);
        }

        // Quitar BOM
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }

        const lines = content.split(/\r?\n/).filter(l => l.trim());
        
        if (lines.length < 2) {
          Alert.alert('Error', 'Archivo vacío');
          return;
        }

        const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const iNombre = header.findIndex(h => h.includes('nombre') || h.includes('name'));
        const iCostoBase = header.findIndex(h => h.includes('base') || h.includes('precio'));
        const iCostoOrig = header.findIndex(h => h.includes('original'));

        if (iNombre === -1) {
          Alert.alert('Error', 'No se encontró columna Nombre');
          return;
        }

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const nombre = (cols[iNombre] || '').trim();
          if (nombre) {
            productos.push({
              nombre,
              costo_original: parseFloat(cols[iCostoOrig] || cols[iCostoBase] || '0') || 0,
              costo_base: parseFloat(cols[iCostoBase] || cols[iCostoOrig] || '0') || 0,
            });
          }
        }
      }

      if (productos.length === 0) {
        Alert.alert('Error', 'No se encontraron productos en el archivo');
        return;
      }

      setProgress(0.3);
      setStatus(`Procesando ${productos.length} productos...`);

      // Productos existentes
      const existingRes = await productosApi.getAll();
      const existingMap = new Map<string, any>();
      existingRes.data.forEach((p: any) => {
        existingMap.set(p.nombre.toLowerCase().trim(), p);
      });

      // Procesar
      let nuevos = 0, actualizados = 0, sinCambios = 0, errores = 0;
      const total = productos.length;

      for (let i = 0; i < productos.length; i++) {
        try {
          const { nombre, costo_original, costo_base } = productos[i];
          
          if (!nombre) { errores++; continue; }

          const existing = existingMap.get(nombre.toLowerCase().trim());

          if (existing) {
            if (Math.abs(existing.costo_base - costo_base) > 0.01) {
              await productosApi.update(existing._id, {
                ...existing,
                costo_base,
                costo_original,
                comentarios: (existing.comentarios || '') + `\n[Actualizado: ${new Date().toLocaleDateString()}]`,
              });
              actualizados++;
            } else {
              sinCambios++;
            }
          } else {
            await productosApi.create({ nombre, costo_original, costo_base, comentarios: '' });
            nuevos++;
          }

          if (i % 10 === 0) {
            setProgress(0.3 + (0.6 * i / total));
            setStatus(`${i}/${total}...`);
          }
        } catch { errores++; }
      }

      setProgress(1);
      setImportResults({ nuevos, actualizados, sinCambios, errores });
      Alert.alert('Listo', `Nuevos: ${nuevos}\nActualizados: ${actualizados}\nSin cambios: ${sinCambios}`);
      
    } catch (error: any) {
      console.error('Error importar:', error);
      Alert.alert('Error', 'No se pudo importar: ' + (error?.message || ''));
    } finally {
      setLoading(false);
      setStatus('');
      setProgress(0);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const r: string[] = [];
    let c = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { q = !q; }
      else if (ch === ',' && !q) { r.push(c.trim()); c = ''; }
      else if (ch !== '\r') { c += ch; }
    }
    r.push(c.trim());
    return r;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <List.Icon icon="download" color="#6200ee" />
              <Text style={styles.title}>Exportar</Text>
            </View>
            <Text style={styles.desc}>Guarda todos los productos en un archivo Excel (.xlsx)</Text>
            <Button mode="contained" onPress={exportarDatos} loading={loading && status.includes('Cargando')} disabled={loading} icon="file-export" style={styles.btn}>
              Exportar Excel
            </Button>
          </Card.Content>
        </Card>

        {exportResult && (
          <Card style={[styles.card, {backgroundColor: '#e8f5e9'}]}>
            <Card.Content>
              <Text style={{color: '#2e7d32', fontWeight: 'bold'}}>✓ {exportResult.total} productos exportados</Text>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <List.Icon icon="upload" color="#4caf50" />
              <Text style={styles.title}>Importar</Text>
            </View>
            <Text style={styles.desc}>Carga productos desde Excel (.xlsx) o CSV</Text>
            <Text style={styles.note}>• Nuevos se agregan</Text>
            <Text style={styles.note}>• Existentes se actualizan si el precio cambió</Text>
            <Button mode="contained" onPress={importarDatos} loading={loading && status.includes('/')} disabled={loading} icon="file-import" style={styles.btn} buttonColor="#4caf50">
              Importar Excel/CSV
            </Button>
          </Card.Content>
        </Card>

        {loading && status && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <ActivityIndicator size="small" />
                <Text style={{marginLeft: 12, color: '#666'}}>{status}</Text>
              </View>
              <ProgressBar progress={progress} color="#6200ee" style={{marginTop: 12, height: 6, borderRadius: 3}} />
            </Card.Content>
          </Card>
        )}

        {importResults && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={{fontSize: 16, fontWeight: 'bold', marginBottom: 8}}>Resultados</Text>
              <Divider style={{marginVertical: 8}} />
              <View style={styles.resultRow}><Text>Nuevos:</Text><Text style={{fontWeight: 'bold', color: '#4caf50'}}>{importResults.nuevos}</Text></View>
              <View style={styles.resultRow}><Text>Actualizados:</Text><Text style={{fontWeight: 'bold', color: '#ff9800'}}>{importResults.actualizados}</Text></View>
              <View style={styles.resultRow}><Text>Sin cambios:</Text><Text style={{fontWeight: 'bold', color: '#666'}}>{importResults.sinCambios}</Text></View>
              {importResults.errores > 0 && <View style={styles.resultRow}><Text>Errores:</Text><Text style={{fontWeight: 'bold', color: '#f44336'}}>{importResults.errores}</Text></View>}
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <Text style={{fontWeight: 'bold', marginBottom: 8}}>Pasos:</Text>
            <Text style={styles.note}>1. Exporta en celular origen</Text>
            <Text style={styles.note}>2. Envía por WhatsApp/Email</Text>
            <Text style={styles.note}>3. Descarga en celular destino</Text>
            <Text style={styles.note}>4. Importa el archivo</Text>
          </Card.Content>
        </Card>

        <View style={{height: 40}} />
      </ScrollView>

      <Snackbar visible={snackVisible} onDismiss={() => setSnackVisible(false)} duration={3000}>{snackMessage}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  card: { marginBottom: 12, borderRadius: 12, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold' },
  desc: { fontSize: 14, color: '#666', marginBottom: 8 },
  note: { fontSize: 13, color: '#666', marginLeft: 8, marginBottom: 4 },
  btn: { marginTop: 12, borderRadius: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});
