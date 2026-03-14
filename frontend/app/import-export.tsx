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
  List,
  Divider,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { productosApi, calculosApi, cotizacionesApi } from '../services/api';
import { Producto, Calculo, Cotizacion } from '../types/types';

export default function ImportExportScreen() {
  const [loading, setLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  // Exportar datos a Excel
  const exportarDatos = async () => {
    try {
      setLoading(true);
      setExportProgress('Cargando datos...');

      // Obtener todos los datos
      const [productosRes, calculosRes, cotizacionesRes] = await Promise.all([
        productosApi.getAll(),
        calculosApi.getAll(),
        cotizacionesApi.getAll(),
      ]);

      const productos = productosRes.data;
      const calculos = calculosRes.data;
      const cotizaciones = cotizacionesRes.data;

      setExportProgress('Preparando Excel...');

      // Crear hojas del libro
      const wb = XLSX.utils.book_new();

      // Hoja 1: Productos
      const productosData = productos.map(p => ({
        'Nombre': p.nombre,
        'Costo Original': p.costo_original,
        'Costo Base': p.costo_base,
        'Comentarios': p.comentarios || '',
        'Fecha Creación': p.fecha_creacion ? new Date(p.fecha_creacion).toLocaleDateString() : '',
      }));
      const wsProductos = XLSX.utils.json_to_sheet(productosData);
      XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos');

      // Hoja 2: Cálculos (Historial)
      const calculosData: any[] = [];
      calculos.forEach(c => {
        c.clientes.forEach(cliente => {
          calculosData.push({
            'Producto': c.nombre_producto,
            'Flujo': c.flujo_nombre,
            'Cliente': cliente.nombre,
            'Ganancia (%)': cliente.porcentaje_ganancia,
            'Precio Final': cliente.precio_final,
            'Comentario': cliente.comentario || '',
            'Fecha': c.fecha ? new Date(c.fecha).toLocaleDateString() : '',
          });
        });
      });
      const wsCalculos = XLSX.utils.json_to_sheet(calculosData);
      XLSX.utils.book_append_sheet(wb, wsCalculos, 'Historial');

      // Hoja 3: Cotizaciones
      const cotizacionesData: any[] = [];
      cotizaciones.forEach(cot => {
        cot.items.forEach(item => {
          cotizacionesData.push({
            'Cliente': cot.nombre_cliente || 'Sin nombre',
            'Producto': item.nombre_producto,
            'Cantidad': item.cantidad,
            'Precio Unitario': item.precio_unitario,
            'Subtotal': item.subtotal,
            'Total Cotización': cot.total,
            'Fecha': cot.fecha ? new Date(cot.fecha).toLocaleDateString() : '',
          });
        });
      });
      const wsCotizaciones = XLSX.utils.json_to_sheet(cotizacionesData);
      XLSX.utils.book_append_sheet(wb, wsCotizaciones, 'Cotizaciones');

      // Convertir a base64
      setExportProgress('Generando archivo...');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      // Guardar archivo
      const fileName = `Calculadora_${new Date().toISOString().split('T')[0]}.xlsx`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setExportProgress('Compartiendo archivo...');

      // Compartir archivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Exportar datos de Calculadora',
          UTI: 'com.microsoft.excel.xlsx',
        });
        Alert.alert('Éxito', `Archivo exportado: ${fileName}`);
      } else {
        Alert.alert('Error', 'No se puede compartir archivos en este dispositivo');
      }

    } catch (error) {
      console.error('Error al exportar:', error);
      Alert.alert('Error', 'No se pudo exportar los datos: ' + (error as Error).message);
    } finally {
      setLoading(false);
      setExportProgress('');
    }
  };

  // Importar datos desde Excel
  const importarDatos = async () => {
    try {
      setLoading(true);
      setExportProgress('Seleccionando archivo...');

      // Seleccionar archivo
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLoading(false);
        setExportProgress('');
        return;
      }

      setExportProgress('Leyendo archivo...');

      // Leer archivo
      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Parsear Excel
      const wb = XLSX.read(fileContent, { type: 'base64' });

      let productosImportados = 0;
      let calculosImportados = 0;
      let cotizacionesImportadas = 0;

      // Importar Productos
      if (wb.SheetNames.includes('Productos')) {
        setExportProgress('Importando productos...');
        const wsProductos = wb.Sheets['Productos'];
        const productosData = XLSX.utils.sheet_to_json(wsProductos) as any[];

        for (const prod of productosData) {
          try {
            const nombre = prod['Nombre'];
            const costoOriginal = parseFloat(prod['Costo Original']) || 0;
            const costoBase = parseFloat(prod['Costo Base']) || costoOriginal;

            if (!nombre) continue;

            // Verificar si ya existe
            try {
              const busqueda = await productosApi.search(nombre);
              const existe = busqueda.data.find((p: Producto) => 
                p.nombre.toLowerCase() === nombre.toLowerCase()
              );

              if (!existe) {
                await productosApi.create({
                  nombre,
                  costo_original: costoOriginal,
                  costo_base: costoBase,
                  comentarios: prod['Comentarios'] || '',
                });
                productosImportados++;
              }
            } catch (e) {
              // Si falla la búsqueda, crear el producto
              await productosApi.create({
                nombre,
                costo_original: costoOriginal,
                costo_base: costoBase,
                comentarios: prod['Comentarios'] || '',
              });
              productosImportados++;
            }
          } catch (error) {
            console.error('Error al importar producto:', error);
          }
        }
      }

      // Importar Historial
      if (wb.SheetNames.includes('Historial')) {
        setExportProgress('Importando historial...');
        const wsHistorial = wb.Sheets['Historial'];
        const historialData = XLSX.utils.sheet_to_json(wsHistorial) as any[];

        // Agrupar por producto y flujo
        const calculosAgrupados: Record<string, any> = {};
        
        historialData.forEach(item => {
          const key = `${item['Producto']}_${item['Flujo']}_${item['Fecha']}`;
          
          if (!calculosAgrupados[key]) {
            calculosAgrupados[key] = {
              nombre_producto: item['Producto'],
              flujo_nombre: item['Flujo'],
              valores_operaciones: {},
              clientes: [],
              costo_base: 0,
            };
          }

          calculosAgrupados[key].clientes.push({
            nombre: item['Cliente'],
            porcentaje_ganancia: parseFloat(item['Ganancia (%)']) || 0,
            comentario: item['Comentario'] || '',
            precio_final: parseFloat(item['Precio Final']) || 0,
          });
        });

        for (const calculo of Object.values(calculosAgrupados)) {
          try {
            await calculosApi.create(calculo as any);
            calculosImportados++;
          } catch (error) {
            console.error('Error al importar cálculo:', error);
          }
        }
      }

      // Importar Cotizaciones
      if (wb.SheetNames.includes('Cotizaciones')) {
        setExportProgress('Importando cotizaciones...');
        const wsCotizaciones = wb.Sheets['Cotizaciones'];
        const cotizacionesData = XLSX.utils.sheet_to_json(wsCotizaciones) as any[];

        // Agrupar por cliente y fecha
        const cotizacionesAgrupadas: Record<string, any> = {};
        
        cotizacionesData.forEach(item => {
          const key = `${item['Cliente']}_${item['Fecha']}`;
          
          if (!cotizacionesAgrupadas[key]) {
            cotizacionesAgrupadas[key] = {
              nombre_cliente: item['Cliente'],
              items: [],
              total: parseFloat(item['Total Cotización']) || 0,
            };
          }

          cotizacionesAgrupadas[key].items.push({
            cantidad: parseInt(item['Cantidad']) || 0,
            producto_id: '',
            nombre_producto: item['Producto'],
            precio_unitario: parseFloat(item['Precio Unitario']) || 0,
            subtotal: parseFloat(item['Subtotal']) || 0,
          });
        });

        for (const cotizacion of Object.values(cotizacionesAgrupadas)) {
          try {
            await cotizacionesApi.create(cotizacion as any);
            cotizacionesImportadas++;
          } catch (error) {
            console.error('Error al importar cotización:', error);
          }
        }
      }

      // Mostrar resumen
      Alert.alert(
        'Importación Completa',
        `Se importaron correctamente:\n\n` +
        `• ${productosImportados} productos\n` +
        `• ${calculosImportados} cálculos (historial)\n` +
        `• ${cotizacionesImportadas} cotizaciones`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Podrías recargar las pantallas aquí si es necesario
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error al importar:', error);
      Alert.alert('Error', 'No se pudo importar el archivo: ' + (error as Error).message);
    } finally {
      setLoading(false);
      setExportProgress('');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Importar / Exportar Datos</Text>
            <Text style={styles.subtitle}>
              Comparte tus productos, historial y cotizaciones con otros dispositivos.
            </Text>
          </Card.Content>
        </Card>

        {/* Exportar */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Exportar Datos</Text>
            <Text style={styles.description}>
              Descarga un archivo Excel con todos tus datos: productos, historial de cálculos y cotizaciones.
            </Text>
            
            <List.Section>
              <List.Item
                title="Productos"
                description="Todos los productos guardados"
                left={props => <List.Icon {...props} icon="package-variant" />}
              />
              <Divider />
              <List.Item
                title="Historial"
                description="Cálculos con precios y clientes"
                left={props => <List.Icon {...props} icon="history" />}
              />
              <Divider />
              <List.Item
                title="Cotizaciones"
                description="Todas las cotizaciones guardadas"
                left={props => <List.Icon {...props} icon="receipt" />}
              />
            </List.Section>

            {loading && exportProgress && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.progressText}>{exportProgress}</Text>
              </View>
            )}

            <Button
              mode="contained"
              onPress={exportarDatos}
              loading={loading}
              disabled={loading}
              style={styles.button}
              icon="download"
            >
              Exportar a Excel
            </Button>
          </Card.Content>
        </Card>

        {/* Importar */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Importar Datos</Text>
            <Text style={styles.description}>
              Selecciona un archivo Excel exportado previamente para importar los datos.
            </Text>

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠️ Importante:</Text>
              <Text style={styles.warningText}>
                • Solo se agregarán datos nuevos\n
                • No se duplicarán productos existentes\n
                • El proceso puede tardar unos minutos
              </Text>
            </View>

            {loading && exportProgress && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.progressText}>{exportProgress}</Text>
              </View>
            )}

            <Button
              mode="contained"
              onPress={importarDatos}
              loading={loading}
              disabled={loading}
              style={styles.button}
              icon="upload"
            >
              Importar desde Excel
            </Button>
          </Card.Content>
        </Card>

        {/* Instrucciones */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Cómo usar</Text>
            
            <Text style={styles.stepTitle}>Para compartir datos:</Text>
            <Text style={styles.stepText}>
              1. Presiona "Exportar a Excel"\n
              2. Selecciona la app para compartir (WhatsApp, Email, Drive, etc.)\n
              3. Envía el archivo al otro dispositivo
            </Text>

            <Text style={styles.stepTitle}>Para importar datos:</Text>
            <Text style={styles.stepText}>
              1. Guarda el archivo Excel recibido en tu dispositivo\n
              2. Presiona "Importar desde Excel"\n
              3. Selecciona el archivo descargado\n
              4. Espera a que termine la importación
            </Text>
          </Card.Content>
        </Card>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
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
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    marginTop: 16,
    paddingVertical: 6,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginVertical: 8,
  },
  progressText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    marginVertical: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#856404',
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 20,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#6200ee',
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  bottomSpace: {
    height: 32,
  },
});
