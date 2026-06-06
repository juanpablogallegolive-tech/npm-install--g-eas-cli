import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
  TouchableOpacity,
  Keyboard,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Card,
  Searchbar,
  Divider,
  Portal,
  Modal,
  ActivityIndicator,
  ProgressBar,
} from 'react-native-paper';
import { cotizacionesApi, productosApi } from '../services/api';
import { Cotizacion, ItemCotizacion, Producto } from '../types/types';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import LectorTexto from '../components/LectorTexto';

export default function QuotesScreen() {
  const [nombreCliente, setNombreCliente] = useState('');
  const [items, setItems] = useState<Array<{
    cantidad: string;
    producto: Producto | null;
    subtotal: number;
  }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingCotizacionId, setEditingCotizacionId] = useState<string | null>(null);
  const [lectorVisible, setLectorVisible] = useState(false);
  
  // Búsqueda de productos
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null);
  
  // Cotizaciones guardadas
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalExportVisible, setModalExportVisible] = useState(false);
  
  // Export/Import
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadCotizaciones();
  }, []);

  useEffect(() => {
    calcularTotal();
  }, [items]);

  const loadCotizaciones = async () => {
    try {
      const response = await cotizacionesApi.getAll();
      setCotizaciones(response.data);
    } catch (error) {
      console.error('Error al cargar cotizaciones:', error);
    }
  };

  const agregarFila = () => {
    setItems([...items, { cantidad: '1', producto: null, subtotal: 0 }]);
  };

  const eliminarFila = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const actualizarCantidad = (index: number, cantidad: string) => {
    const newItems = [...items];
    // Permitir decimales: reemplazar coma por punto
    const cantidadNormalizada = cantidad.replace(',', '.');
    newItems[index].cantidad = cantidad;
    const cant = parseFloat(cantidadNormalizada) || 0;
    const precio = newItems[index].producto?.costo_base || 0;
    newItems[index].subtotal = cant * precio;
    setItems(newItems);
  };

  const buscarProducto = async (index: number, query: string) => {
    setSearchingIndex(index);
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length >= 1) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await productosApi.search(query);
          setSearchResults(response.data);
          setShowResults(true);
        } catch (error) {
          console.error('Error en búsqueda:', error);
        }
      }, 400);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const seleccionarProducto = (index: number, producto: Producto) => {
    const newItems = [...items];
    newItems[index].producto = producto;
    const cant = parseFloat(newItems[index].cantidad) || 0;
    newItems[index].subtotal = cant * producto.costo_base;
    setItems(newItems);
    setShowResults(false);
    setSearchQuery('');
    setSearchingIndex(null);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    Keyboard.dismiss();
  };

  const calcularTotal = () => {
    const suma = items.reduce((acc, item) => acc + item.subtotal, 0);
    setTotal(suma);
  };

  const limpiar = () => {
    setNombreCliente('');
    setItems([]);
    setTotal(0);
    setEditingCotizacionId(null);
  };

  // Manejar productos del lector
  const handleProductosLector = (productosLector: Array<{ producto: Producto; cantidad: number }>) => {
    const nuevosItems = productosLector.map(p => ({
      cantidad: p.cantidad.toString(),
      producto: p.producto,
      subtotal: p.cantidad * p.producto.costo_base,
    }));
    setItems([...items, ...nuevosItems]);
  };

  const guardarCotizacion = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Agrega al menos un producto');
      return;
    }

    const itemsValidos = items.filter(item => item.producto !== null);
    if (itemsValidos.length === 0) {
      Alert.alert('Error', 'Selecciona productos válidos');
      return;
    }

    try {
      setLoading(true);
      
      const itemsCotizacion: ItemCotizacion[] = itemsValidos.map(item => ({
        cantidad: parseFloat(item.cantidad) || 0,
        producto_id: item.producto!._id,
        nombre_producto: item.producto!.nombre,
        precio_unitario: item.producto!.costo_base,
        subtotal: item.subtotal,
      }));

      if (editingCotizacionId) {
        await cotizacionesApi.update(editingCotizacionId, {
          nombre_cliente: nombreCliente || 'Sin nombre',
          items: itemsCotizacion,
          total,
          fecha: new Date().toISOString(),
        });
        Alert.alert('Éxito', 'Cotización actualizada');
      } else {
        await cotizacionesApi.create({
          nombre_cliente: nombreCliente || 'Sin nombre',
          items: itemsCotizacion,
          total,
        });
        Alert.alert('Éxito', 'Cotización guardada');
      }

      limpiar();
      loadCotizaciones();
    } catch (error) {
      console.error('Error al guardar cotización:', error);
      Alert.alert('Error', 'No se pudo guardar la cotización');
    } finally {
      setLoading(false);
    }
  };

  const cargarCotizacion = (cotizacion: Cotizacion) => {
    setModalVisible(false);
    setEditingCotizacionId(cotizacion._id);
    setNombreCliente(cotizacion.nombre_cliente || '');
    
    const itemsCargados = cotizacion.items.map(item => ({
      cantidad: item.cantidad.toString(),
      producto: {
        _id: item.producto_id,
        nombre: item.nombre_producto,
        costo_base: item.precio_unitario,
        costo_original: item.precio_unitario,
        comentarios: '',
      } as Producto,
      subtotal: item.subtotal,
    }));
    
    setItems(itemsCargados);
    Alert.alert('Cargado', 'Cotización cargada para editar');
  };

  const eliminarCotizacion = async (id: string) => {
    Alert.alert('Confirmar', '¿Eliminar esta cotización?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cotizacionesApi.delete(id);
            loadCotizaciones();
            Alert.alert('Eliminado', 'Cotización eliminada');
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'Fecha inválida';
    }
  };

  // ========== EXPORTAR COTIZACIONES ==========
  const exportarCotizaciones = async () => {
    setExportLoading(true);
    setExportProgress(0);
    setExportStatus('Preparando cotizaciones...');

    try {
      if (cotizaciones.length === 0) {
        Alert.alert('Info', 'No hay cotizaciones para exportar');
        return;
      }

      setExportProgress(0.3);
      
      // Crear datos para Excel
      const data: any[] = [];
      cotizaciones.forEach((cot, index) => {
        cot.items.forEach((item, itemIndex) => {
          data.push({
            'Cotizacion_ID': index + 1,
            'Cliente': cot.nombre_cliente || 'Sin nombre',
            'Fecha': formatDate(cot.fecha),
            'Producto': item.nombre_producto,
            'Cantidad': item.cantidad,
            'Precio_Unitario': item.precio_unitario,
            'Subtotal': item.subtotal,
            'Total_Cotizacion': itemIndex === 0 ? cot.total : '',
          });
        });
      });

      setExportProgress(0.5);
      setExportStatus('Generando Excel...');

      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [
        { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 40 },
        { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cotizaciones');
      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `cotizaciones_${Date.now()}.xlsx`;

      setExportProgress(0.7);

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
        Alert.alert('Éxito', `${cotizaciones.length} cotizaciones exportadas`);
      } else {
        setExportStatus('Guardando archivo...');
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, excelBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setExportProgress(0.9);
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Guardar cotizaciones',
          });
          Alert.alert('Éxito', `${cotizaciones.length} cotizaciones exportadas`);
        }
      }

      setExportProgress(1);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo exportar');
    } finally {
      setExportLoading(false);
      setExportStatus('');
      setExportProgress(0);
    }
  };

  // ========== EXPORTAR COTIZACIÓN INDIVIDUAL ==========
  const exportarCotizacionIndividual = async (cotizacion: Cotizacion) => {
    try {
      const data = cotizacion.items.map(item => ({
        'Cliente': cotizacion.nombre_cliente || 'Sin nombre',
        'Producto': item.nombre_producto,
        'Cantidad': item.cantidad,
        'Precio_Unitario': item.precio_unitario,
        'Subtotal': item.subtotal,
      }));

      // Agregar fila de total
      data.push({
        'Cliente': '',
        'Producto': 'TOTAL',
        'Cantidad': '',
        'Precio_Unitario': '',
        'Subtotal': cotizacion.total,
      } as any);

      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cotizacion');
      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const clienteName = (cotizacion.nombre_cliente || 'cotizacion').replace(/\s+/g, '_');
      const fileName = `cotizacion_${clienteName}_${Date.now()}.xlsx`;

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
      } else {
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, excelBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Compartir cotización',
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo exportar la cotización');
    }
  };

  // ========== IMPORTAR COTIZACIONES ==========
  const importarCotizaciones = async () => {
    setExportLoading(true);
    setExportProgress(0);
    setExportStatus('Selecciona archivo...');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setExportStatus('Leyendo archivo...');
      setExportProgress(0.2);

      let fileContent: string;
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const arrayBuffer = await response.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        await procesarImportacion(jsonData);
      } else {
        fileContent = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const wb = XLSX.read(fileContent, { type: 'base64' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        await procesarImportacion(jsonData);
      }

    } catch (error: any) {
      Alert.alert('Error', 'No se pudo importar: ' + (error?.message || ''));
    } finally {
      setExportLoading(false);
      setExportStatus('');
      setExportProgress(0);
    }
  };

  const procesarImportacion = async (jsonData: any[]) => {
    setExportStatus('Procesando datos...');
    setExportProgress(0.5);

    // Agrupar por Cotizacion_ID o Cliente
    const cotizacionesMap = new Map<string, any[]>();
    
    jsonData.forEach((row: any) => {
      const key = row['Cotizacion_ID'] || row['Cliente'] || 'Sin ID';
      if (!cotizacionesMap.has(key)) {
        cotizacionesMap.set(key, []);
      }
      cotizacionesMap.get(key)!.push(row);
    });

    let importados = 0;
    const total = cotizacionesMap.size;

    for (const [key, rows] of cotizacionesMap) {
      try {
        const cliente = rows[0]['Cliente'] || 'Importado';
        const items: ItemCotizacion[] = rows
          .filter((r: any) => r['Producto'] && r['Producto'] !== 'TOTAL')
          .map((r: any) => ({
            cantidad: parseFloat(r['Cantidad']) || 1,
            producto_id: '',
            nombre_producto: r['Producto'] || 'Producto',
            precio_unitario: parseFloat(r['Precio_Unitario']) || 0,
            subtotal: parseFloat(r['Subtotal']) || 0,
          }));

        if (items.length > 0) {
          const totalCot = items.reduce((acc, item) => acc + item.subtotal, 0);
          await cotizacionesApi.create({
            nombre_cliente: cliente,
            items,
            total: totalCot,
          });
          importados++;
        }

        setExportProgress(0.5 + (0.4 * importados / total));
      } catch (error) {
        console.error('Error importando cotización:', error);
      }
    }

    setExportProgress(1);
    loadCotizaciones();
    Alert.alert('Listo', `${importados} cotizaciones importadas`);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Header con estado de edición */}
        {editingCotizacionId && (
          <Card style={[styles.card, styles.editingCard]}>
            <Card.Content>
              <View style={styles.editingHeader}>
                <Text style={styles.editingText}>Editando cotización</Text>
                <Button mode="text" onPress={limpiar} textColor="#d32f2f">Cancelar</Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Nombre del Cliente */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Cliente</Text>
            <TextInput
              mode="outlined"
              label="Nombre del cliente (opcional)"
              value={nombreCliente}
              onChangeText={setNombreCliente}
              style={styles.input}
            />
          </Card.Content>
        </Card>

        {/* Items */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Productos</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton icon="plus" size={24} onPress={agregarFila} mode="contained" />
              </View>
            </View>

            {/* Botón grande para escanear/pegar lista */}
            <TouchableOpacity 
              style={styles.lectorButton} 
              onPress={() => setLectorVisible(true)}
            >
              <IconButton icon="text-recognition" size={28} iconColor="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.lectorButtonText}>Escanear / Pegar Lista</Text>
                <Text style={styles.lectorButtonDesc}>Agrega varios productos a la vez</Text>
              </View>
              <IconButton icon="chevron-right" size={24} iconColor="#fff" />
            </TouchableOpacity>

            {items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Item {index + 1}</Text>
                  <IconButton icon="delete" size={20} iconColor="#d32f2f" onPress={() => eliminarFila(index)} />
                </View>

                <TextInput
                  mode="outlined"
                  label="Cantidad"
                  value={item.cantidad}
                  onChangeText={(text) => actualizarCantidad(index, text)}
                  keyboardType="numeric"
                  style={styles.inputSmall}
                  dense
                />

                <Searchbar
                  placeholder="Buscar producto..."
                  onChangeText={(query) => buscarProducto(index, query)}
                  value={searchingIndex === index ? searchQuery : (item.producto?.nombre || '')}
                  style={styles.searchbar}
                />

                {showResults && searchingIndex === index && searchResults.length > 0 && (
                  <View style={styles.resultsContainer}>
                    <ScrollView style={styles.resultsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {searchResults.map((producto) => (
                        <TouchableOpacity
                          key={producto._id}
                          onPress={() => seleccionarProducto(index, producto)}
                          style={styles.resultItem}
                        >
                          <Text style={styles.resultTitle} numberOfLines={2}>{producto.nombre}</Text>
                          <Text style={styles.resultPrice}>${producto.costo_base.toLocaleString()}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {item.producto && (
                  <View style={styles.subtotalBox}>
                    <Text style={styles.subtotalLabel}>Subtotal:</Text>
                    <Text style={styles.subtotalValor}>${item.subtotal.toLocaleString()}</Text>
                  </View>
                )}
              </View>
            ))}

            {items.length === 0 && (
              <Text style={styles.emptyText}>Presiona + para agregar productos</Text>
            )}

            {items.length > 0 && (
              <Button mode="outlined" onPress={agregarFila} icon="plus" style={{ marginTop: 8 }}>
                Agregar otro producto
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Total */}
        {total > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>TOTAL:</Text>
                <Text style={styles.totalValor}>${total.toLocaleString()}</Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Botones */}
        <View style={styles.buttonContainer}>
          <Button mode="contained" onPress={guardarCotizacion} loading={loading} disabled={items.length === 0} icon="content-save">
            {editingCotizacionId ? 'Actualizar Cotización' : 'Guardar Cotización'}
          </Button>
          
          <Button mode="outlined" onPress={limpiar} icon="eraser">
            Limpiar
          </Button>
          
          <Divider style={styles.divider} />
          
          <Button mode="contained" onPress={() => setModalVisible(true)} icon="folder-open" buttonColor="#1976d2">
            Ver Cotizaciones Guardadas
          </Button>
          
          <Button mode="outlined" onPress={() => setModalExportVisible(true)} icon="swap-horizontal">
            Importar / Exportar
          </Button>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de Cotizaciones */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Cotizaciones Guardadas</Text>
          
          {cotizaciones.length === 0 ? (
            <Text style={styles.emptyText}>No hay cotizaciones guardadas</Text>
          ) : (
            <FlatList
              data={cotizaciones}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <Card style={styles.cotizacionCard}>
                  <Card.Content>
                    <TouchableOpacity onPress={() => cargarCotizacion(item)}>
                      <Text style={styles.cotizacionCliente}>{item.nombre_cliente || 'Sin nombre'}</Text>
                      <Text style={styles.cotizacionFecha}>{formatDate(item.fecha)}</Text>
                      <Text style={styles.cotizacionItems}>{item.items.length} productos</Text>
                      <Text style={styles.cotizacionTotal}>Total: ${item.total.toLocaleString()}</Text>
                    </TouchableOpacity>
                    
                    <Divider style={{ marginVertical: 8 }} />
                    
                    <View style={styles.cotizacionActions}>
                      <Button mode="text" onPress={() => cargarCotizacion(item)} icon="pencil" compact>Editar</Button>
                      <Button mode="text" onPress={() => exportarCotizacionIndividual(item)} icon="share" compact>Compartir</Button>
                      <Button mode="text" onPress={() => eliminarCotizacion(item._id)} icon="delete" textColor="#d32f2f" compact>Eliminar</Button>
                    </View>
                  </Card.Content>
                </Card>
              )}
            />
          )}

          <Button mode="contained" onPress={() => setModalVisible(false)} style={styles.modalButton}>
            Cerrar
          </Button>
        </Modal>
      </Portal>

      {/* Modal de Exportar/Importar */}
      <Portal>
        <Modal visible={modalExportVisible} onDismiss={() => setModalExportVisible(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Importar / Exportar Cotizaciones</Text>
          
          <Card style={styles.exportCard}>
            <Card.Content>
              <Text style={styles.exportTitle}>Exportar</Text>
              <Text style={styles.exportDesc}>Guarda todas las cotizaciones en un archivo Excel</Text>
              <Button mode="contained" onPress={exportarCotizaciones} icon="download" disabled={exportLoading || cotizaciones.length === 0}>
                Exportar Todas ({cotizaciones.length})
              </Button>
            </Card.Content>
          </Card>

          <Card style={styles.exportCard}>
            <Card.Content>
              <Text style={styles.exportTitle}>Importar</Text>
              <Text style={styles.exportDesc}>Carga cotizaciones desde un archivo Excel</Text>
              <Button mode="contained" onPress={importarCotizaciones} icon="upload" buttonColor="#4caf50" disabled={exportLoading}>
                Importar Excel
              </Button>
            </Card.Content>
          </Card>

          {exportLoading && (
            <Card style={styles.exportCard}>
              <Card.Content>
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.loadingText}>{exportStatus}</Text>
                </View>
                <ProgressBar progress={exportProgress} color="#6200ee" style={styles.progressBar} />
              </Card.Content>
            </Card>
          )}

          <Button mode="outlined" onPress={() => setModalExportVisible(false)} style={styles.modalButton}>
            Cerrar
          </Button>
        </Modal>
      </Portal>

      {/* Lector de Texto */}
      <LectorTexto
        visible={lectorVisible}
        onClose={() => setLectorVisible(false)}
        onProductosSeleccionados={handleProductosLector}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  card: { margin: 16, marginBottom: 8, borderRadius: 12, elevation: 2 },
  editingCard: { backgroundColor: '#fff3e0', borderColor: '#ff9800', borderWidth: 1 },
  editingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editingText: { fontSize: 16, fontWeight: 'bold', color: '#e65100' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  input: { backgroundColor: '#fff' },
  inputSmall: { backgroundColor: '#fff', marginBottom: 8 },
  itemCard: { backgroundColor: '#fafafa', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { fontSize: 16, fontWeight: 'bold', color: '#6200ee' },
  searchbar: { marginBottom: 8, elevation: 0, backgroundColor: '#fff' },
  resultsContainer: { maxHeight: 300, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 8 },
  resultsScroll: { maxHeight: 300 },
  resultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  resultTitle: { fontSize: 14, fontWeight: '500', color: '#333' },
  resultPrice: { fontSize: 12, color: '#6200ee', marginTop: 4 },
  subtotalBox: { backgroundColor: '#e3f2fd', padding: 10, borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtotalLabel: { fontSize: 14, color: '#1565c0' },
  subtotalValor: { fontSize: 16, fontWeight: 'bold', color: '#0d47a1' },
  totalBox: { backgroundColor: '#e8f5e9', padding: 16, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#2e7d32' },
  totalValor: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20' },
  emptyText: { textAlign: 'center', color: '#999', paddingVertical: 20, fontSize: 14 },
  buttonContainer: { padding: 16, gap: 12 },
  divider: { marginVertical: 8 },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 12, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  cotizacionCard: { marginBottom: 12, borderRadius: 10 },
  cotizacionCliente: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  cotizacionFecha: { fontSize: 12, color: '#999', marginBottom: 4 },
  cotizacionItems: { fontSize: 14, color: '#666' },
  cotizacionTotal: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginTop: 4 },
  cotizacionActions: { flexDirection: 'row', justifyContent: 'space-around' },
  modalButton: { marginTop: 16 },
  exportCard: { marginBottom: 12, borderRadius: 10 },
  exportTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  exportDesc: { fontSize: 13, color: '#666', marginBottom: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  loadingText: { marginLeft: 12, color: '#666' },
  progressBar: { height: 6, borderRadius: 3 },
  lectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  lectorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lectorButtonDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
});
