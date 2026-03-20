import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  ActivityIndicator,
  Divider,
  List,
  ProgressBar,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { productosApi, calculosApi, flujosApi } from '../services/api';

// Simple XLSX writer for export
const createSimpleXLSX = (data: any[][], sheetName: string): string => {
  // Create a simple CSV that can be opened in Excel
  let csv = '';
  data.forEach(row => {
    csv += row.map(cell => {
      const cellStr = String(cell || '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',') + '\n';
  });
  return csv;
};

export default function ImportExportScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    productos: { nuevos: number; actualizados: number; sinCambios: number };
    errores: number;
  } | null>(null);

  // Exportar datos a CSV (compatible con Excel)
  const exportarDatos = async () => {
    try {
      setLoading(true);
      setProgress(0);
      setStatus('Cargando productos...');

      const productosRes = await productosApi.getAll();
      const productos = productosRes.data;

      setProgress(0.3);
      setStatus('Generando archivo...');

      // Crear CSV con productos
      const csvData: any[][] = [];
      
      // Header
      csvData.push(['Nombre', 'Costo_Original', 'Costo_Base', 'Comentarios']);
      
      // Data
      productos.forEach((p: any) => {
        csvData.push([
          p.nombre || '',
          p.costo_original || 0,
          p.costo_base || 0,
          (p.comentarios || '').replace(/\n/g, ' | '),
        ]);
      });

      const csvContent = createSimpleXLSX(csvData, 'Productos');
      const fecha = new Date().toISOString().split('T')[0];
      const fileName = `productos_${fecha}.csv`;

      setProgress(0.8);
      setStatus('Guardando archivo...');

      if (Platform.OS === 'web') {
        // Web: Download directly
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Alert.alert('Éxito', `Archivo "${fileName}" descargado.\n\nProductos exportados: ${productos.length}`);
      } else {
        // Mobile: Save and share
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Compartir Productos',
          });
        } else {
          Alert.alert('Éxito', `Archivo guardado en:\n${fileUri}`);
        }
      }

      setProgress(1);
      setStatus('');
    } catch (error) {
      console.error('Error al exportar:', error);
      Alert.alert('Error', 'No se pudo exportar. Intenta de nuevo.');
      setStatus('');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  // Importar datos desde CSV/Excel
  const importarDatos = async () => {
    try {
      setLoading(true);
      setProgress(0);
      setStatus('Seleccionando archivo...');
      setImportResults(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 
               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setStatus('');
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      setStatus('Leyendo archivo...');
      setProgress(0.1);

      let fileContent: string;

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        fileContent = await response.text();
      } else {
        fileContent = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      setProgress(0.2);
      setStatus('Procesando datos...');

      // Parse CSV
      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        Alert.alert('Error', 'El archivo está vacío o no tiene datos válidos');
        setLoading(false);
        return;
      }

      // Get header
      const header = parseCSVLine(lines[0]);
      const nombreIdx = findColumnIndex(header, ['nombre', 'Nombre', 'NOMBRE', 'producto', 'Producto']);
      const costoOrigIdx = findColumnIndex(header, ['costo_original', 'Costo_Original', 'Costo Original', 'costo original']);
      const costoBaseIdx = findColumnIndex(header, ['costo_base', 'Costo_Base', 'Costo Base', 'costo base', 'precio', 'Precio']);

      if (nombreIdx === -1) {
        Alert.alert('Error', 'No se encontró la columna "Nombre" en el archivo');
        setLoading(false);
        return;
      }

      setProgress(0.3);
      setStatus('Cargando productos existentes...');

      // Get existing products
      const existingRes = await productosApi.getAll();
      const existingProducts = existingRes.data;
      const existingMap = new Map<string, any>();
      existingProducts.forEach((p: any) => {
        existingMap.set(p.nombre.toLowerCase().trim(), p);
      });

      setProgress(0.4);

      let productosNuevos = 0;
      let productosActualizados = 0;
      let productosSinCambios = 0;
      let errores = 0;

      const total = lines.length - 1;

      for (let i = 1; i < lines.length; i++) {
        try {
          const row = parseCSVLine(lines[i]);
          if (row.length === 0) continue;

          const nombre = (row[nombreIdx] || '').toString().trim();
          if (!nombre) {
            errores++;
            continue;
          }

          const costoOriginal = parseFloat(row[costoOrigIdx] || row[costoBaseIdx] || '0') || 0;
          const costoBase = parseFloat(row[costoBaseIdx] || row[costoOrigIdx] || '0') || costoOriginal;

          const existing = existingMap.get(nombre.toLowerCase().trim());

          if (existing) {
            // Check if price changed
            if (Math.abs(existing.costo_base - costoBase) > 0.01 || Math.abs(existing.costo_original - costoOriginal) > 0.01) {
              const fecha = new Date().toLocaleDateString('es-CO');
              const nuevoComentario = `${existing.comentarios || ''}\n[Sync: $${existing.costo_base.toLocaleString()} → $${costoBase.toLocaleString()} el ${fecha}]`.trim();
              
              await productosApi.update(existing._id, {
                nombre: existing.nombre,
                costo_original: costoOriginal,
                costo_base: costoBase,
                comentarios: nuevoComentario,
              });
              productosActualizados++;
            } else {
              productosSinCambios++;
            }
          } else {
            // Create new
            await productosApi.create({
              nombre,
              costo_original: costoOriginal,
              costo_base: costoBase,
              comentarios: '',
            });
            productosNuevos++;
          }

          setProgress(0.4 + (0.5 * (i / total)));
          setStatus(`Procesando ${i}/${total}...`);
        } catch (e) {
          console.error('Error en fila:', i, e);
          errores++;
        }
      }

      setProgress(1);
      setStatus('');

      setImportResults({
        productos: { nuevos: productosNuevos, actualizados: productosActualizados, sinCambios: productosSinCambios },
        errores,
      });

      Alert.alert(
        'Importación Completa',
        `Nuevos: ${productosNuevos}\nActualizados: ${productosActualizados}\nSin cambios: ${productosSinCambios}\nErrores: ${errores}`
      );

    } catch (error) {
      console.error('Error al importar:', error);
      Alert.alert('Error', 'No se pudo importar el archivo. Verifica que sea un archivo CSV válido.');
      setStatus('');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  // Parse CSV line handling quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  // Find column index by possible names
  const findColumnIndex = (header: string[], possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const idx = header.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Exportar */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <List.Icon icon="download" color="#6200ee" />
              <Text style={styles.title}>Exportar Productos</Text>
            </View>
            <Text style={styles.description}>
              Descarga un archivo CSV con todos los productos. Este archivo puede abrirse en Excel y compartirse a otro celular.
            </Text>
            <Button
              mode="contained"
              onPress={exportarDatos}
              loading={loading && status.includes('Generando')}
              disabled={loading}
              icon="file-export"
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Exportar a CSV
            </Button>
          </Card.Content>
        </Card>

        {/* Importar */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <List.Icon icon="upload" color="#4caf50" />
              <Text style={styles.title}>Importar Productos</Text>
            </View>
            <Text style={styles.description}>
              Importa productos desde un archivo CSV o Excel exportado de otro celular.
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Debe tener columna "Nombre"</Text>
              <Text style={styles.bulletItem}>• Columnas opcionales: "Costo_Base", "Costo_Original"</Text>
              <Text style={styles.bulletItem}>• Productos existentes se actualizan si el precio cambió</Text>
              <Text style={styles.bulletItem}>• No se duplican productos</Text>
            </View>
            <Button
              mode="contained"
              onPress={importarDatos}
              loading={loading && status.includes('Procesando')}
              disabled={loading}
              icon="file-import"
              style={styles.button}
              buttonColor="#4caf50"
              contentStyle={styles.buttonContent}
            >
              Importar desde CSV/Excel
            </Button>
          </Card.Content>
        </Card>

        {/* Progreso */}
        {loading && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color="#6200ee" />
                <Text style={styles.statusText}>{status}</Text>
              </View>
              {progress > 0 && (
                <ProgressBar progress={progress} color="#6200ee" style={styles.progressBar} />
              )}
            </Card.Content>
          </Card>
        )}

        {/* Resultados */}
        {importResults && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.resultsTitle}>Resultados de Importación</Text>
              <Divider style={styles.divider} />
              <List.Item
                title="Productos nuevos"
                right={() => <Text style={[styles.resultNumber, { color: '#4caf50' }]}>{importResults.productos.nuevos}</Text>}
                left={() => <List.Icon icon="plus-circle" color="#4caf50" />}
              />
              <List.Item
                title="Productos actualizados"
                right={() => <Text style={[styles.resultNumber, { color: '#ff9800' }]}>{importResults.productos.actualizados}</Text>}
                left={() => <List.Icon icon="update" color="#ff9800" />}
              />
              <List.Item
                title="Sin cambios"
                right={() => <Text style={[styles.resultNumber, { color: '#666' }]}>{importResults.productos.sinCambios}</Text>}
                left={() => <List.Icon icon="check-circle" color="#666" />}
              />
              {importResults.errores > 0 && (
                <List.Item
                  title="Errores"
                  right={() => <Text style={[styles.resultNumber, { color: '#f44336' }]}>{importResults.errores}</Text>}
                  left={() => <List.Icon icon="alert-circle" color="#f44336" />}
                />
              )}
            </Card.Content>
          </Card>
        )}

        {/* Instrucciones */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.infoTitle}>¿Cómo sincronizar entre celulares?</Text>
            <View style={styles.stepList}>
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                <Text style={styles.stepText}>En el celular origen, presiona "Exportar a CSV"</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={styles.stepText}>Comparte el archivo por WhatsApp, Email o Drive</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={styles.stepText}>En el celular destino, descarga el archivo</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
                <Text style={styles.stepText}>Presiona "Importar desde CSV/Excel" y selecciona el archivo</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  card: { margin: 16, marginBottom: 8, elevation: 2, borderRadius: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  description: { fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 20 },
  bulletList: { marginBottom: 12, paddingLeft: 8 },
  bulletItem: { fontSize: 13, color: '#666', marginBottom: 4 },
  button: { marginTop: 8, borderRadius: 8 },
  buttonContent: { paddingVertical: 6 },
  statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  statusText: { fontSize: 14, color: '#666', flex: 1 },
  progressBar: { height: 6, borderRadius: 3 },
  resultsTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  divider: { marginVertical: 8 },
  resultNumber: { fontSize: 18, fontWeight: 'bold' },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  stepList: { gap: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#6200ee', justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  stepText: { flex: 1, fontSize: 14, color: '#666', lineHeight: 20, paddingTop: 4 },
  bottomSpace: { height: 32 },
});
