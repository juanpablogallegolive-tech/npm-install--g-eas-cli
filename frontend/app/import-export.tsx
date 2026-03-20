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
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { productosApi } from '../services/api';

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

  // Crear contenido CSV
  const createCSV = (productos: any[]): string => {
    let csv = 'Nombre,Costo_Original,Costo_Base\n';
    productos.forEach((p) => {
      const nombre = String(p.nombre || '').replace(/"/g, '""').replace(/,/g, ' ');
      csv += `"${nombre}",${p.costo_original || 0},${p.costo_base || 0}\n`;
    });
    return csv;
  };

  // ========== EXPORTAR ==========
  const exportarDatos = async () => {
    setLoading(true);
    setProgress(0);
    setStatus('Cargando productos...');
    setExportResult(null);
    
    try {
      // 1. Cargar productos
      const response = await productosApi.getAll();
      const productos = response.data;
      
      if (!productos || productos.length === 0) {
        Alert.alert('Info', 'No hay productos para exportar');
        return;
      }

      setProgress(0.4);
      setStatus(`Preparando ${productos.length} productos...`);

      // 2. Crear CSV
      const csvContent = createCSV(productos);
      const fileName = `productos_${Date.now()}.csv`;

      setProgress(0.6);

      if (Platform.OS === 'web') {
        // WEB: Descargar directamente
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setExportResult({ total: productos.length });
        showSnack('Archivo descargado');
      } else {
        // MÓVIL: Usar Sharing (funciona en Expo Go y builds)
        setStatus('Preparando archivo...');
        setProgress(0.7);

        // Escribir en directorio de documentos de la app (siempre accesible)
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(filePath, '\uFEFF' + csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        setProgress(0.85);
        setStatus('Abriendo compartir...');

        // Verificar si sharing está disponible
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          // Abrir menú de compartir - permite guardar, enviar por WhatsApp, etc.
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/csv',
            dialogTitle: 'Guardar o compartir productos',
            UTI: 'public.comma-separated-values-text',
          });
          
          setExportResult({ total: productos.length });
          showSnack(`${productos.length} productos listos para guardar`);
        } else {
          Alert.alert('Error', 'No se puede compartir en este dispositivo');
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
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setStatus('Leyendo archivo...');
      setProgress(0.2);

      // 2. Leer contenido
      let content: string;
      
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      // Quitar BOM
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }

      // 3. Parsear
      const lines = content.split(/\r?\n/).filter(l => l.trim());
      
      if (lines.length < 2) {
        Alert.alert('Error', 'Archivo vacío');
        return;
      }

      setProgress(0.3);

      // Header
      const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const iNombre = header.findIndex(h => h.includes('nombre') || h.includes('name') || h.includes('producto'));
      const iCostoBase = header.findIndex(h => h.includes('base') || h.includes('precio') || h.includes('costo'));
      const iCostoOrig = header.findIndex(h => h.includes('original'));

      if (iNombre === -1) {
        Alert.alert('Error', 'No se encontró columna Nombre');
        return;
      }

      // 4. Productos existentes
      setStatus('Verificando existentes...');
      const existingRes = await productosApi.getAll();
      const existingMap = new Map<string, any>();
      existingRes.data.forEach((p: any) => {
        existingMap.set(p.nombre.toLowerCase().trim(), p);
      });

      // 5. Procesar
      let nuevos = 0, actualizados = 0, sinCambios = 0, errores = 0;
      const total = lines.length - 1;

      for (let i = 1; i < lines.length; i++) {
        try {
          const cols = parseCSVLine(lines[i]);
          const nombre = (cols[iNombre] || '').trim();
          
          if (!nombre) { errores++; continue; }

          const costoBase = parseFloat(cols[iCostoBase] || cols[iCostoOrig] || '0') || 0;
          const costoOrig = parseFloat(cols[iCostoOrig] || cols[iCostoBase] || '0') || costoBase;

          const existing = existingMap.get(nombre.toLowerCase().trim());

          if (existing) {
            if (Math.abs(existing.costo_base - costoBase) > 0.01) {
              await productosApi.update(existing._id, {
                ...existing,
                costo_base: costoBase,
                costo_original: costoOrig,
                comentarios: (existing.comentarios || '') + `\n[Actualizado: ${new Date().toLocaleDateString()}]`,
              });
              actualizados++;
            } else {
              sinCambios++;
            }
          } else {
            await productosApi.create({ nombre, costo_original: costoOrig, costo_base: costoBase, comentarios: '' });
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
      Alert.alert('Error', 'No se pudo importar');
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
            <Text style={styles.desc}>Guarda todos los productos en un archivo CSV</Text>
            <Button mode="contained" onPress={exportarDatos} loading={loading && status.includes('Cargando')} disabled={loading} icon="file-export" style={styles.btn}>
              Exportar CSV
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
            <Text style={styles.desc}>Carga productos desde un archivo CSV</Text>
            <Text style={styles.note}>• Nuevos se agregan</Text>
            <Text style={styles.note}>• Existentes se actualizan si el precio cambió</Text>
            <Button mode="contained" onPress={importarDatos} loading={loading && status.includes('/')} disabled={loading} icon="file-import" style={styles.btn} buttonColor="#4caf50">
              Importar CSV
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
