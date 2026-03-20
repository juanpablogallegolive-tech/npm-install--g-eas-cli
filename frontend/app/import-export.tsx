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
  
  const [exportResult, setExportResult] = useState<{ total: number; fileName: string } | null>(null);
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
  const createCSVContent = (productos: any[]): string => {
    let csv = 'Nombre,Costo_Original,Costo_Base,Comentarios\n';
    
    productos.forEach((p) => {
      const nombre = String(p.nombre || '').replace(/"/g, '""');
      const costoOrig = p.costo_original || 0;
      const costoBase = p.costo_base || 0;
      const comentarios = String(p.comentarios || '').replace(/"/g, '""').replace(/\n/g, ' ');
      
      csv += `"${nombre}",${costoOrig},${costoBase},"${comentarios}"\n`;
    });
    
    return csv;
  };

  // EXPORTAR - Función principal
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
        showSnack('No hay productos para exportar');
        setLoading(false);
        setStatus('');
        return;
      }

      setProgress(0.3);
      setStatus(`Generando archivo (${productos.length} productos)...`);

      // 2. Crear contenido CSV
      const csvContent = createCSVContent(productos);
      
      // 3. Nombre del archivo
      const fecha = new Date().toISOString().slice(0, 10);
      const fileName = `productos_${fecha}.csv`;

      setProgress(0.6);
      setStatus('Preparando descarga...');

      // 4. Guardar y compartir según plataforma
      if (Platform.OS === 'web') {
        // WEB: Descargar directamente
        const BOM = '\uFEFF'; // Para que Excel reconozca UTF-8
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        setExportResult({ total: productos.length, fileName });
        showSnack(`Descargado: ${fileName}`);
        
      } else {
        // MÓVIL: Guardar en cache y compartir
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) {
          throw new Error('No se puede acceder al directorio de cache');
        }
        
        const filePath = cacheDir + fileName;
        
        // Escribir archivo
        await FileSystem.writeAsStringAsync(filePath, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        setProgress(0.8);
        setStatus('Abriendo opciones de compartir...');
        
        // Verificar si se puede compartir
        const canShare = await Sharing.isAvailableAsync();
        
        if (canShare) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/csv',
            dialogTitle: 'Exportar Productos',
            UTI: 'public.comma-separated-values-text',
          });
          setExportResult({ total: productos.length, fileName });
          showSnack(`${productos.length} productos exportados`);
        } else {
          // Si no se puede compartir, mostrar la ruta
          setExportResult({ total: productos.length, fileName: filePath });
          showSnack(`Archivo guardado en: ${filePath}`);
        }
      }

      setProgress(1);
      
    } catch (error: any) {
      console.error('Error exportando:', error);
      const errorMsg = error?.message || 'Error desconocido';
      showSnack(`Error: ${errorMsg}`);
      Alert.alert('Error al Exportar', `No se pudo exportar: ${errorMsg}\n\nIntenta de nuevo.`);
    } finally {
      setLoading(false);
      setStatus('');
      setProgress(0);
    }
  };

  // IMPORTAR - Función principal
  const importarDatos = async () => {
    setLoading(true);
    setProgress(0);
    setStatus('Selecciona un archivo CSV...');
    setImportResults(null);
    setExportResult(null);

    try {
      // 1. Seleccionar archivo
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setLoading(false);
        setStatus('');
        return;
      }

      const file = result.assets[0];
      setStatus('Leyendo archivo...');
      setProgress(0.1);

      // 2. Leer contenido del archivo
      let content: string;
      
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      // 3. Parsear CSV
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length < 2) {
        showSnack('Archivo vacío o sin datos');
        setLoading(false);
        setStatus('');
        return;
      }

      setProgress(0.2);
      setStatus('Analizando datos...');

      // Parsear header
      const header = parseCSVLine(lines[0]);
      const colNombre = findColumn(header, ['nombre', 'producto', 'name']);
      const colCostoOrig = findColumn(header, ['costo_original', 'costo original', 'original']);
      const colCostoBase = findColumn(header, ['costo_base', 'costo base', 'costo', 'precio', 'price']);

      if (colNombre === -1) {
        showSnack('No se encontró columna "Nombre"');
        Alert.alert('Error', 'El archivo debe tener una columna llamada "Nombre"');
        setLoading(false);
        setStatus('');
        return;
      }

      setProgress(0.3);
      setStatus('Cargando productos existentes...');

      // 4. Obtener productos existentes
      const existingRes = await productosApi.getAll();
      const existingMap = new Map<string, any>();
      existingRes.data.forEach((p: any) => {
        existingMap.set(p.nombre.toLowerCase().trim(), p);
      });

      // 5. Procesar cada línea
      let nuevos = 0;
      let actualizados = 0;
      let sinCambios = 0;
      let errores = 0;
      const total = lines.length - 1;

      for (let i = 1; i < lines.length; i++) {
        try {
          const row = parseCSVLine(lines[i]);
          
          const nombre = (row[colNombre] || '').trim();
          if (!nombre) {
            errores++;
            continue;
          }

          const costoOrig = parseFloat(row[colCostoOrig] || row[colCostoBase] || '0') || 0;
          const costoBase = parseFloat(row[colCostoBase] || row[colCostoOrig] || '0') || costoOrig;

          const existing = existingMap.get(nombre.toLowerCase().trim());

          if (existing) {
            // Producto existe - verificar si cambió el precio
            const cambioOrig = Math.abs(existing.costo_original - costoOrig) > 0.01;
            const cambioBase = Math.abs(existing.costo_base - costoBase) > 0.01;
            
            if (cambioOrig || cambioBase) {
              const fecha = new Date().toLocaleDateString('es-CO');
              let comentario = existing.comentarios || '';
              comentario += `\n[Importado: $${existing.costo_base} -> $${costoBase} el ${fecha}]`;
              
              await productosApi.update(existing._id, {
                nombre: existing.nombre,
                costo_original: costoOrig,
                costo_base: costoBase,
                comentarios: comentario.trim(),
              });
              actualizados++;
            } else {
              sinCambios++;
            }
          } else {
            // Producto nuevo
            await productosApi.create({
              nombre,
              costo_original: costoOrig,
              costo_base: costoBase,
              comentarios: '',
            });
            nuevos++;
          }

          // Actualizar progreso cada 10 items
          if (i % 10 === 0) {
            setProgress(0.3 + (0.6 * i / total));
            setStatus(`Procesando ${i}/${total}...`);
          }
        } catch (e) {
          console.error('Error en línea', i, e);
          errores++;
        }
      }

      setProgress(1);
      setImportResults({ nuevos, actualizados, sinCambios, errores });
      
      const mensaje = `Nuevos: ${nuevos}, Actualizados: ${actualizados}, Sin cambios: ${sinCambios}`;
      showSnack(mensaje);
      
    } catch (error: any) {
      console.error('Error importando:', error);
      showSnack('Error al importar archivo');
      Alert.alert('Error', 'No se pudo leer el archivo. Verifica que sea un CSV válido.');
    } finally {
      setLoading(false);
      setStatus('');
      setProgress(0);
    }
  };

  // Parsear línea CSV respetando comillas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else if (c !== '\r') {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Buscar columna por posibles nombres
  const findColumn = (header: string[], names: string[]): number => {
    for (const name of names) {
      const idx = header.findIndex(h => 
        h.toLowerCase().trim().replace(/['"]/g, '') === name.toLowerCase()
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* EXPORTAR */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.header}>
              <List.Icon icon="download" color="#6200ee" />
              <Text style={styles.title}>Exportar Productos</Text>
            </View>
            <Text style={styles.desc}>
              Descarga todos los productos en un archivo CSV. Puedes abrirlo en Excel y compartirlo a otro celular.
            </Text>
            <Button
              mode="contained"
              onPress={exportarDatos}
              loading={loading && status.includes('Cargando')}
              disabled={loading}
              icon="file-export"
              style={styles.btn}
            >
              Exportar a CSV
            </Button>
          </Card.Content>
        </Card>

        {/* Resultado exportación */}
        {exportResult && (
          <Card style={[styles.card, styles.successCard]}>
            <Card.Content>
              <List.Icon icon="check-circle" color="#4caf50" />
              <Text style={styles.successText}>
                ✓ {exportResult.total} productos exportados
              </Text>
              <Text style={styles.fileText}>{exportResult.fileName}</Text>
            </Card.Content>
          </Card>
        )}

        {/* IMPORTAR */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.header}>
              <List.Icon icon="upload" color="#4caf50" />
              <Text style={styles.title}>Importar Productos</Text>
            </View>
            <Text style={styles.desc}>
              Importa productos desde un archivo CSV. Debe tener columna "Nombre".
            </Text>
            <Text style={styles.note}>• Productos nuevos se agregan</Text>
            <Text style={styles.note}>• Productos existentes se actualizan si el precio cambió</Text>
            <Text style={styles.note}>• No se duplican productos</Text>
            <Button
              mode="contained"
              onPress={importarDatos}
              loading={loading && status.includes('Procesando')}
              disabled={loading}
              icon="file-import"
              style={styles.btn}
              buttonColor="#4caf50"
            >
              Importar CSV
            </Button>
          </Card.Content>
        </Card>

        {/* Progreso */}
        {loading && status && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.progressRow}>
                <ActivityIndicator size="small" color="#6200ee" />
                <Text style={styles.statusText}>{status}</Text>
              </View>
              <ProgressBar progress={progress} color="#6200ee" style={styles.progressBar} />
            </Card.Content>
          </Card>
        )}

        {/* Resultado importación */}
        {importResults && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.resultsTitle}>Resultados</Text>
              <Divider style={styles.divider} />
              <View style={styles.resultRow}>
                <Text>Productos nuevos:</Text>
                <Text style={[styles.resultNum, {color: '#4caf50'}]}>{importResults.nuevos}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text>Actualizados:</Text>
                <Text style={[styles.resultNum, {color: '#ff9800'}]}>{importResults.actualizados}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text>Sin cambios:</Text>
                <Text style={[styles.resultNum, {color: '#666'}]}>{importResults.sinCambios}</Text>
              </View>
              {importResults.errores > 0 && (
                <View style={styles.resultRow}>
                  <Text>Errores:</Text>
                  <Text style={[styles.resultNum, {color: '#f44336'}]}>{importResults.errores}</Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Instrucciones */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.infoTitle}>Sincronizar entre celulares:</Text>
            <Text style={styles.step}>1. Exporta en el celular origen</Text>
            <Text style={styles.step}>2. Comparte por WhatsApp/Email/Drive</Text>
            <Text style={styles.step}>3. Descarga en el celular destino</Text>
            <Text style={styles.step}>4. Importa el archivo CSV</Text>
          </Card.Content>
        </Card>

        <View style={{height: 40}} />
      </ScrollView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={4000}
        action={{ label: 'OK', onPress: () => setSnackVisible(false) }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 12, borderRadius: 12, elevation: 2 },
  successCard: { backgroundColor: '#e8f5e9' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  desc: { fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 20 },
  note: { fontSize: 13, color: '#666', marginLeft: 8, marginBottom: 4 },
  btn: { marginTop: 12, borderRadius: 8 },
  successText: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginTop: 8 },
  fileText: { fontSize: 12, color: '#666', marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  statusText: { fontSize: 14, color: '#666', flex: 1 },
  progressBar: { height: 6, borderRadius: 3 },
  resultsTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  divider: { marginVertical: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  resultNum: { fontSize: 18, fontWeight: 'bold' },
  infoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  step: { fontSize: 14, color: '#666', marginBottom: 6, marginLeft: 8 },
});
