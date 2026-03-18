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
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { productosApi, calculosApi } from '../services/api';
import { Producto } from '../types/types';

export default function ImportExportScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [importResults, setImportResults] = useState<{
    nuevos: number;
    actualizados: number;
    errores: number;
  } | null>(null);

  const exportarProductos = async () => {
    try {
      setLoading(true);
      setStatus('Cargando productos...');

      // Get all products
      const productosResponse = await productosApi.getAll();
      const productos = productosResponse.data;

      // Get history for price changes
      const calculosResponse = await calculosApi.getAll();
      const calculos = calculosResponse.data;

      setStatus('Generando Excel...');

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Products sheet
      const productosData = productos.map(p => ({
        'Nombre': p.nombre,
        'Costo Original': p.costo_original,
        'Costo Base': p.costo_base,
        'Comentarios': p.comentarios || '',
        'Fecha Creación': p.fecha_creacion ? new Date(p.fecha_creacion).toLocaleDateString() : '',
      }));

      const wsProductos = XLSX.utils.json_to_sheet(productosData);
      XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos');

      // History sheet with client prices
      const historialData = calculos.map(c => {
        const row: any = {
          'Producto': c.nombre_producto,
          'Flujo': c.flujo_nombre,
          'Costo Base': c.costo_base,
          'Fecha': c.fecha ? new Date(c.fecha).toLocaleDateString() : '',
        };
        // Add client prices
        c.clientes.forEach((cliente, idx) => {
          row[`Cliente ${idx + 1} - Nombre`] = cliente.nombre;
          row[`Cliente ${idx + 1} - Ganancia %`] = cliente.porcentaje_ganancia;
          row[`Cliente ${idx + 1} - Precio Final`] = cliente.precio_final;
        });
        return row;
      });

      if (historialData.length > 0) {
        const wsHistorial = XLSX.utils.json_to_sheet(historialData);
        XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial Precios');
      }

      // Generate file
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `productos_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      if (Platform.OS === 'web') {
        // Web download
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
        Alert.alert('Éxito', 'Archivo descargado');
      } else {
        // Mobile - save and share
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar Productos',
          });
        } else {
          Alert.alert('Éxito', `Archivo guardado en: ${fileUri}`);
        }
      }

      setStatus('');
    } catch (error) {
      console.error('Error al exportar:', error);
      Alert.alert('Error', 'No se pudo exportar los productos');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const importarProductos = async () => {
    try {
      setLoading(true);
      setStatus('Seleccionando archivo...');
      setImportResults(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
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
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      setStatus(`Procesando ${data.length} registros...`);

      // Get existing products
      const existingResponse = await productosApi.getAll();
      const existingProducts = existingResponse.data;
      const existingMap = new Map(existingProducts.map(p => [p.nombre.toLowerCase(), p]));

      let nuevos = 0;
      let actualizados = 0;
      let errores = 0;

      for (const row of data as any[]) {
        try {
          const nombre = row['Nombre'] || row['nombre'] || row['NOMBRE'];
          const costoOriginal = parseFloat(row['Costo Original'] || row['costo_original'] || row['Costo'] || 0);
          const costoBase = parseFloat(row['Costo Base'] || row['costo_base'] || costoOriginal);
          const comentarios = row['Comentarios'] || row['comentarios'] || '';

          if (!nombre) {
            errores++;
            continue;
          }

          const existing = existingMap.get(nombre.toLowerCase());

          if (existing) {
            // Update if price changed
            if (existing.costo_base !== costoBase || existing.costo_original !== costoOriginal) {
              await productosApi.update(existing._id, {
                nombre,
                costo_original: costoOriginal,
                costo_base: costoBase,
                comentarios: comentarios + `\n[Actualizado desde Excel: ${new Date().toLocaleDateString()}]`,
              });
              actualizados++;
            }
          } else {
            // Create new product
            await productosApi.create({
              nombre,
              costo_original: costoOriginal,
              costo_base: costoBase,
              comentarios,
            });
            nuevos++;
          }
        } catch (e) {
          errores++;
        }
      }

      setImportResults({ nuevos, actualizados, errores });
      setStatus('');
      Alert.alert(
        'Importación Completa',
        `Nuevos: ${nuevos}\nActualizados: ${actualizados}\nErrores: ${errores}`
      );

    } catch (error) {
      console.error('Error al importar:', error);
      Alert.alert('Error', 'No se pudo importar el archivo');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Exportar Datos</Text>
          <Text style={styles.description}>
            Descarga un archivo Excel con todos los productos y el historial de precios por cliente.
            Útil para hacer backup o transferir a otro dispositivo.
          </Text>
          <Button
            mode="contained"
            onPress={exportarProductos}
            loading={loading}
            disabled={loading}
            icon="download"
            style={styles.button}
          >
            Exportar a Excel
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Importar Datos</Text>
          <Text style={styles.description}>
            Importa productos desde un archivo Excel. El archivo debe tener columnas:
            "Nombre", "Costo Original", "Costo Base".
          </Text>
          <Text style={styles.note}>
            * Si un producto ya existe, se actualizará su precio y se marcará como actualizado.
          </Text>
          <Button
            mode="contained"
            onPress={importarProductos}
            loading={loading}
            disabled={loading}
            icon="upload"
            style={styles.button}
            buttonColor="#4caf50"
          >
            Importar desde Excel
          </Button>
        </Card.Content>
      </Card>

      {loading && status && (
        <Card style={styles.card}>
          <Card.Content style={styles.statusContainer}>
            <ActivityIndicator size="small" />
            <Text style={styles.statusText}>{status}</Text>
          </Card.Content>
        </Card>
      )}

      {importResults && (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.resultsTitle}>Resultados de Importación</Text>
            <Divider style={styles.divider} />
            <List.Item
              title="Productos nuevos"
              right={() => <Text style={styles.resultNumber}>{importResults.nuevos}</Text>}
              left={() => <List.Icon icon="plus-circle" color="#4caf50" />}
            />
            <List.Item
              title="Productos actualizados"
              right={() => <Text style={styles.resultNumber}>{importResults.actualizados}</Text>}
              left={() => <List.Icon icon="update" color="#ff9800" />}
            />
            <List.Item
              title="Errores"
              right={() => <Text style={styles.resultNumber}>{importResults.errores}</Text>}
              left={() => <List.Icon icon="alert-circle" color="#f44336" />}
            />
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.infoTitle}>Información</Text>
          <Text style={styles.infoText}>
            Esta función permite sincronizar productos entre dispositivos sin necesidad de una conexión a base de datos compartida.
          </Text>
          <Text style={styles.infoText}>
            1. Exporta desde el dispositivo origen
          </Text>
          <Text style={styles.infoText}>
            2. Comparte el archivo (WhatsApp, Email, etc.)
          </Text>
          <Text style={styles.infoText}>
            3. Importa en el dispositivo destino
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  note: {
    fontSize: 12,
    color: '#ff9800',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  button: {
    marginTop: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
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
    color: '#6200ee',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  bottomSpace: {
    height: 32,
  },
});
