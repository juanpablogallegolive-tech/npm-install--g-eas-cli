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
import * as XLSX from 'xlsx';
import { productosApi, calculosApi, flujosApi, cotizacionesApi } from '../services/api';

export default function ImportExportScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    productos: { nuevos: number; actualizados: number; sinCambios: number };
    historial: { importados: number };
    errores: number;
  } | null>(null);

  // Exportar TODOS los datos de la aplicación
  const exportarDatos = async () => {
    try {
      setLoading(true);
      setProgress(0);
      setStatus('Cargando productos...');

      // Cargar todos los datos
      const [productosRes, calculosRes, flujosRes, cotizacionesRes] = await Promise.all([
        productosApi.getAll(),
        calculosApi.getAll(),
        flujosApi.getAll(),
        cotizacionesApi.getAll(),
      ]);

      const productos = productosRes.data;
      const calculos = calculosRes.data;
      const flujos = flujosRes.data;
      const cotizaciones = cotizacionesRes.data;

      setProgress(0.3);
      setStatus('Generando Excel...');

      const wb = XLSX.utils.book_new();

      // ===== HOJA 1: Productos =====
      const productosData = productos.map((p: any) => ({
        'ID': p._id,
        'Nombre': p.nombre,
        'Costo_Original': p.costo_original,
        'Costo_Base': p.costo_base,
        'Flujo_ID': p.flujo_id || '',
        'Comentarios': p.comentarios || '',
        'Fecha_Creacion': p.fecha_creacion || '',
      }));
      const wsProductos = XLSX.utils.json_to_sheet(productosData);
      XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos');

      setProgress(0.5);

      // ===== HOJA 2: Historial de Cálculos =====
      const historialData = calculos.map((c: any) => {
        const row: any = {
          'ID': c._id,
          'Producto': c.nombre_producto,
          'Flujo_Nombre': c.flujo_nombre,
          'Flujo_ID': c.flujo_id || '',
          'Costo_Base': c.costo_base,
          'Fecha': c.fecha || '',
          'Valores_Operaciones': JSON.stringify(c.valores_operaciones || {}),
          'Clientes_JSON': JSON.stringify(c.clientes || []),
        };
        return row;
      });
      if (historialData.length > 0) {
        const wsHistorial = XLSX.utils.json_to_sheet(historialData);
        XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial');
      }

      setProgress(0.7);

      // ===== HOJA 3: Flujos =====
      const flujosData = flujos.map((f: any) => ({
        'ID': f._id,
        'Nombre': f.nombre,
        'Operaciones_JSON': JSON.stringify(f.operaciones || []),
        'Fecha_Creacion': f.fecha_creacion || '',
      }));
      if (flujosData.length > 0) {
        const wsFlujos = XLSX.utils.json_to_sheet(flujosData);
        XLSX.utils.book_append_sheet(wb, wsFlujos, 'Flujos');
      }

      // ===== HOJA 4: Cotizaciones =====
      const cotizacionesData = cotizaciones.map((c: any) => ({
        'ID': c._id,
        'Cliente': c.nombre_cliente || '',
        'Items_JSON': JSON.stringify(c.items || []),
        'Total': c.total || 0,
        'Fecha': c.fecha || '',
      }));
      if (cotizacionesData.length > 0) {
        const wsCotizaciones = XLSX.utils.json_to_sheet(cotizacionesData);
        XLSX.utils.book_append_sheet(wb, wsCotizaciones, 'Cotizaciones');
      }

      setProgress(0.9);
      setStatus('Guardando archivo...');

      // Generar archivo
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fecha = new Date().toISOString().split('T')[0];
      const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileName = `backup_calculadora_${fecha}_${hora}.xlsx`;

      if (Platform.OS === 'web') {
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), c => c.charCodeAt(0))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('Éxito', `Archivo "${fileName}" descargado.\n\nProductos: ${productos.length}\nHistorial: ${calculos.length}\nFlujos: ${flujos.length}`);
      } else {
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Compartir Backup',
            UTI: 'com.microsoft.excel.xlsx',
          });
        } else {
          Alert.alert('Éxito', `Archivo guardado: ${fileUri}`);
        }
      }

      setProgress(1);
      setStatus('');
    } catch (error) {
      console.error('Error al exportar:', error);
      Alert.alert('Error', 'No se pudo exportar los datos. Intenta de nuevo.');
      setStatus('');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  // Importar datos desde Excel
  const importarDatos = async () => {
    try {
      setLoading(true);
      setProgress(0);
      setStatus('Seleccionando archivo...');
      setImportResults(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
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
        const blob = await response.blob();
        fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsBinaryString(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        fileContent = atob(base64);
      }

      const workbook = XLSX.read(fileContent, { type: 'binary' });
      setProgress(0.2);

      // Obtener productos existentes para comparar
      setStatus('Verificando datos existentes...');
      const existingRes = await productosApi.getAll();
      const existingProducts = existingRes.data;
      const existingMap = new Map(existingProducts.map((p: any) => [p.nombre.toLowerCase().trim(), p]));

      setProgress(0.3);

      let productosNuevos = 0;
      let productosActualizados = 0;
      let productosSinCambios = 0;
      let historialImportados = 0;
      let errores = 0;

      // ===== Procesar hoja de Productos =====
      if (workbook.SheetNames.includes('Productos')) {
        setStatus('Importando productos...');
        const wsProductos = workbook.Sheets['Productos'];
        const productosData = XLSX.utils.sheet_to_json(wsProductos) as any[];

        const total = productosData.length;
        let processed = 0;

        for (const row of productosData) {
          try {
            const nombre = (row['Nombre'] || row['nombre'] || '').toString().trim();
            if (!nombre) {
              errores++;
              continue;
            }

            const costoOriginal = parseFloat(row['Costo_Original'] || row['Costo Original'] || row['costo_original'] || 0);
            const costoBase = parseFloat(row['Costo_Base'] || row['Costo Base'] || row['costo_base'] || costoOriginal);
            const comentarios = (row['Comentarios'] || row['comentarios'] || '').toString();
            const flujoId = (row['Flujo_ID'] || row['flujo_id'] || '').toString();

            const existing = existingMap.get(nombre.toLowerCase().trim());

            if (existing) {
              // Solo actualizar si hay cambios en precio
              if (existing.costo_base !== costoBase || existing.costo_original !== costoOriginal) {
                const fecha = new Date().toLocaleDateString('es-CO');
                const nuevoComentario = `${existing.comentarios || ''}\n[Sync: $${existing.costo_base.toLocaleString()} → $${costoBase.toLocaleString()} el ${fecha}]`.trim();
                
                await productosApi.update(existing._id, {
                  nombre: existing.nombre,
                  costo_original: costoOriginal,
                  costo_base: costoBase,
                  comentarios: nuevoComentario,
                  flujo_id: flujoId || existing.flujo_id,
                });
                productosActualizados++;
              } else {
                productosSinCambios++;
              }
            } else {
              // Crear nuevo producto
              await productosApi.create({
                nombre,
                costo_original: costoOriginal,
                costo_base: costoBase,
                comentarios,
                flujo_id: flujoId || undefined,
              });
              productosNuevos++;
            }

            processed++;
            setProgress(0.3 + (0.5 * processed / total));
          } catch (e) {
            console.error('Error procesando producto:', e);
            errores++;
          }
        }
      }

      // ===== Procesar hoja de Historial =====
      if (workbook.SheetNames.includes('Historial')) {
        setStatus('Importando historial...');
        const wsHistorial = workbook.Sheets['Historial'];
        const historialData = XLSX.utils.sheet_to_json(wsHistorial) as any[];

        // Obtener IDs de historial existentes para no duplicar
        const existingCalculosRes = await calculosApi.getAll();
        const existingCalculosIds = new Set(existingCalculosRes.data.map((c: any) => c._id));

        for (const row of historialData) {
          try {
            const id = row['ID'] || '';
            
            // Si ya existe este ID, saltar
            if (existingCalculosIds.has(id)) {
              continue;
            }

            const nombreProducto = row['Producto'] || '';
            const flujoNombre = row['Flujo_Nombre'] || row['Flujo'] || '';
            const flujoId = row['Flujo_ID'] || '';
            const costoBase = parseFloat(row['Costo_Base'] || row['Costo Base'] || 0);
            
            let valoresOperaciones = {};
            let clientes = [];

            try {
              valoresOperaciones = JSON.parse(row['Valores_Operaciones'] || '{}');
            } catch (e) {}

            try {
              clientes = JSON.parse(row['Clientes_JSON'] || '[]');
            } catch (e) {}

            if (nombreProducto && clientes.length > 0) {
              await calculosApi.create({
                nombre_producto: nombreProducto,
                flujo_nombre: flujoNombre,
                flujo_id: flujoId,
                valores_operaciones: valoresOperaciones,
                clientes: clientes,
                costo_base: costoBase,
              });
              historialImportados++;
            }
          } catch (e) {
            console.error('Error procesando historial:', e);
            errores++;
          }
        }
      }

      setProgress(1);
      setStatus('');

      setImportResults({
        productos: { 
          nuevos: productosNuevos, 
          actualizados: productosActualizados, 
          sinCambios: productosSinCambios 
        },
        historial: { importados: historialImportados },
        errores,
      });

      Alert.alert(
        'Importación Completa',
        `Productos nuevos: ${productosNuevos}\nProductos actualizados: ${productosActualizados}\nSin cambios: ${productosSinCambios}\nHistorial importado: ${historialImportados}\nErrores: ${errores}`
      );

    } catch (error) {
      console.error('Error al importar:', error);
      Alert.alert('Error', 'No se pudo importar el archivo. Verifica que sea un archivo Excel válido.');
      setStatus('');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Exportar */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <List.Icon icon="download" color="#6200ee" />
              <Text style={styles.title}>Exportar Datos</Text>
            </View>
            <Text style={styles.description}>
              Descarga un archivo Excel con todos tus datos: productos, historial de cálculos, flujos y cotizaciones.
            </Text>
            <Text style={styles.description}>
              Puedes enviar este archivo por WhatsApp, Email o cualquier otra app para importarlo en otro celular.
            </Text>
            <Button
              mode="contained"
              onPress={exportarDatos}
              loading={loading && status.includes('Generando')}
              disabled={loading}
              icon="file-excel"
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Exportar Todo a Excel
            </Button>
          </Card.Content>
        </Card>

        {/* Importar */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <List.Icon icon="upload" color="#4caf50" />
              <Text style={styles.title}>Importar Datos</Text>
            </View>
            <Text style={styles.description}>
              Importa productos y datos desde un archivo Excel exportado de otro celular.
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Productos nuevos se agregan</Text>
              <Text style={styles.bulletItem}>• Productos existentes se actualizan si cambió el precio</Text>
              <Text style={styles.bulletItem}>• No se duplican datos</Text>
            </View>
            <Button
              mode="contained"
              onPress={importarDatos}
              loading={loading && status.includes('Importando')}
              disabled={loading}
              icon="file-import"
              style={styles.button}
              buttonColor="#4caf50"
              contentStyle={styles.buttonContent}
            >
              Importar desde Excel
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
                <ProgressBar 
                  progress={progress} 
                  color="#6200ee" 
                  style={styles.progressBar}
                />
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
                description="Agregados a la base de datos"
                right={() => <Text style={[styles.resultNumber, { color: '#4caf50' }]}>{importResults.productos.nuevos}</Text>}
                left={() => <List.Icon icon="plus-circle" color="#4caf50" />}
              />
              <List.Item
                title="Productos actualizados"
                description="Precio modificado"
                right={() => <Text style={[styles.resultNumber, { color: '#ff9800' }]}>{importResults.productos.actualizados}</Text>}
                left={() => <List.Icon icon="update" color="#ff9800" />}
              />
              <List.Item
                title="Sin cambios"
                description="Ya estaban actualizados"
                right={() => <Text style={[styles.resultNumber, { color: '#666' }]}>{importResults.productos.sinCambios}</Text>}
                left={() => <List.Icon icon="check-circle" color="#666" />}
              />
              <List.Item
                title="Historial importado"
                description="Registros de cálculos"
                right={() => <Text style={[styles.resultNumber, { color: '#2196f3' }]}>{importResults.historial.importados}</Text>}
                left={() => <List.Icon icon="history" color="#2196f3" />}
              />
              {importResults.errores > 0 && (
                <List.Item
                  title="Errores"
                  description="Registros con problemas"
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
                <Text style={styles.stepText}>En el celular origen, presiona "Exportar Todo a Excel"</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={styles.stepText}>Comparte el archivo por WhatsApp, Email o Drive</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={styles.stepText}>En el celular destino, descarga y abre el archivo</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
                <Text style={styles.stepText}>Presiona "Importar desde Excel" y selecciona el archivo</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  bulletList: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  bulletItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
  },
  resultNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  stepList: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    paddingTop: 4,
  },
  bottomSpace: {
    height: 32,
  },
});
