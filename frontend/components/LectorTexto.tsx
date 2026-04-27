import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput as RNTextInput,
  Modal,
  Image,
  FlatList,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  IconButton,
  ActivityIndicator,
  Divider,
  TextInput,
  Searchbar,
} from 'react-native-paper';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { matchProductos, productosApi, guardarAprendizaje } from '../services/api';
import { Producto } from '../types/types';

interface ProductoMatch {
  nombre_original: string;
  nombre_editado: string;
  producto_sugerido: Producto | null;
  score: number;
  sospechoso: boolean;
  aprendido?: boolean;
  modificado?: boolean; // Si el usuario cambió manualmente
}

interface Props {
  onProductosSeleccionados: (productos: Array<{ producto: Producto; cantidad: number }>) => void;
  onClose: () => void;
  visible: boolean;
}

export default function LectorTexto({ onProductosSeleccionados, onClose, visible }: Props) {
  const [step, setStep] = useState<'input' | 'edit' | 'match' | 'result'>('input');
  const [inputMethod, setInputMethod] = useState<'text' | 'camera' | 'gallery' | null>(null);
  const [textoCapturado, setTextoCapturado] = useState('');
  const [lineasTexto, setLineasTexto] = useState<string[]>([]);
  const [matches, setMatches] = useState<ProductoMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  
  // Para cambiar producto
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Producto[]>([]);
  
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const resetear = () => {
    setStep('input');
    setInputMethod(null);
    setTextoCapturado('');
    setLineasTexto([]);
    setMatches([]);
    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
  };

  // Buscar productos para cambiar
  const buscarProductoParaCambiar = async (query: string) => {
    setBusquedaProducto(query);
    if (query.length >= 1) {
      try {
        const response = await productosApi.search(query);
        setResultadosBusqueda(response.data.slice(0, 20));
      } catch (error) {
        console.error('Error buscando:', error);
      }
    } else {
      setResultadosBusqueda([]);
    }
  };

  // Cambiar producto manualmente y guardar aprendizaje
  const cambiarProducto = async (index: number, nuevoProducto: Producto) => {
    const match = matches[index];
    
    // Guardar aprendizaje en el backend
    try {
      await guardarAprendizaje({
        nombre_original: match.nombre_original,
        producto_id_correcto: nuevoProducto._id,
        nombre_producto_correcto: nuevoProducto.nombre,
      });
    } catch (error) {
      console.error('Error guardando aprendizaje:', error);
    }
    
    // Actualizar el match
    const nuevosMatches = [...matches];
    nuevosMatches[index] = {
      ...match,
      producto_sugerido: nuevoProducto,
      nombre_editado: nuevoProducto.nombre,
      score: 1.0,
      sospechoso: false,
      aprendido: true,
      modificado: true,
    };
    setMatches(nuevosMatches);
    
    // Cerrar búsqueda
    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
    
    Alert.alert('✓ Aprendizaje guardado', `La IA recordará que "${match.nombre_original}" = "${nuevoProducto.nombre}"`);
  };

  // Confirmar que la sugerencia es correcta (también aprende)
  const confirmarSugerencia = async (index: number) => {
    const match = matches[index];
    if (!match.producto_sugerido) return;
    
    // Guardar aprendizaje para reforzar
    try {
      await guardarAprendizaje({
        nombre_original: match.nombre_original,
        producto_id_correcto: match.producto_sugerido._id,
        nombre_producto_correcto: match.producto_sugerido.nombre,
      });
    } catch (error) {
      console.error('Error guardando aprendizaje:', error);
    }
    
    // Actualizar el match
    const nuevosMatches = [...matches];
    nuevosMatches[index] = {
      ...match,
      sospechoso: false,
      aprendido: true,
    };
    setMatches(nuevosMatches);
    
    Alert.alert('✓ Confirmado', 'La IA recordará esta asociación');
  };

  // Saltar/omitir un producto
  const saltarProducto = (index: number) => {
    const nuevosMatches = [...matches];
    nuevosMatches[index] = {
      ...nuevosMatches[index],
      producto_sugerido: null,
      sospechoso: false,
    };
    setMatches(nuevosMatches);
    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
  };

  // Procesar texto en líneas (nombres de productos)
  const procesarTexto = () => {
    if (!textoCapturado.trim()) {
      Alert.alert('Error', 'Ingresa texto primero');
      return;
    }
    
    // Separar por líneas y limpiar
    const lineas = textoCapturado
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2); // Ignorar líneas muy cortas
    
    if (lineas.length === 0) {
      Alert.alert('Error', 'No se encontraron productos en el texto');
      return;
    }
    
    setLineasTexto(lineas);
    setStep('edit');
  };

  // Editar línea individual
  const editarLinea = (index: number, valor: string) => {
    const nuevas = [...lineasTexto];
    nuevas[index] = valor;
    setLineasTexto(nuevas);
  };

  // Eliminar línea
  const eliminarLinea = (index: number) => {
    setLineasTexto(lineasTexto.filter((_, i) => i !== index));
  };

  // Buscar matches con IA
  const buscarMatches = async () => {
    if (lineasTexto.length === 0) {
      Alert.alert('Error', 'No hay productos para buscar');
      return;
    }

    setLoading(true);
    setStep('match');

    try {
      const response = await matchProductos(lineasTexto);
      const resultados: ProductoMatch[] = response.data.map((r, i) => ({
        nombre_original: lineasTexto[i],
        nombre_editado: r.producto_sugerido?.nombre || lineasTexto[i],
        producto_sugerido: r.producto_sugerido,
        score: r.score,
        sospechoso: r.sospechoso,
      }));
      
      setMatches(resultados);
      setStep('result');
    } catch (error) {
      console.error('Error buscando matches:', error);
      Alert.alert('Error', 'No se pudo buscar productos similares');
      setStep('edit');
    } finally {
      setLoading(false);
    }
  };

  // Confirmar selección
  const confirmarSeleccion = () => {
    const productosValidos = matches
      .filter(m => m.producto_sugerido)
      .map(m => ({
        producto: m.producto_sugerido!,
        cantidad: 1,
      }));

    if (productosValidos.length === 0) {
      Alert.alert('Error', 'No hay productos válidos para agregar');
      return;
    }

    onProductosSeleccionados(productosValidos);
    resetear();
    onClose();
  };

  // Tomar foto con cámara
  const tomarFoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso necesario', 'Necesitas dar permiso a la cámara');
        return;
      }
    }
    setCameraVisible(true);
  };

  // Capturar imagen de cámara
  const capturarImagen = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true });
        setCameraVisible(false);
        
        // Aquí iría OCR real - por ahora pedimos texto manual
        Alert.alert(
          'Foto capturada',
          'La foto fue tomada. Por ahora, copia el texto de la imagen manualmente.',
          [{ text: 'OK', onPress: () => setInputMethod('text') }]
        );
      } catch (error) {
        Alert.alert('Error', 'No se pudo tomar la foto');
      }
    }
  };

  // Seleccionar de galería
  const seleccionarGaleria = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      // Aquí iría OCR real - por ahora pedimos texto manual
      Alert.alert(
        'Imagen seleccionada',
        'La imagen fue seleccionada. Por ahora, copia el texto de la imagen manualmente.',
        [{ text: 'OK', onPress: () => setInputMethod('text') }]
      );
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Lector de Productos</Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* PASO 1: Seleccionar método de entrada */}
          {step === 'input' && !inputMethod && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.stepTitle}>¿Cómo quieres ingresar los productos?</Text>
                
                <TouchableOpacity style={styles.methodButton} onPress={() => setInputMethod('text')}>
                  <IconButton icon="pencil" size={32} iconColor="#6200ee" />
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>Escribir / Pegar texto</Text>
                    <Text style={styles.methodDesc}>Copia y pega la lista de productos</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.methodButton} onPress={tomarFoto}>
                  <IconButton icon="camera" size={32} iconColor="#6200ee" />
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>Cámara</Text>
                    <Text style={styles.methodDesc}>Toma una foto del texto</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.methodButton} onPress={seleccionarGaleria}>
                  <IconButton icon="image" size={32} iconColor="#6200ee" />
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>Galería</Text>
                    <Text style={styles.methodDesc}>Selecciona una imagen existente</Text>
                  </View>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          )}

          {/* Entrada de texto */}
          {step === 'input' && inputMethod === 'text' && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.stepTitle}>Ingresa los nombres de productos</Text>
                <Text style={styles.hint}>Un producto por línea</Text>
                
                <RNTextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={10}
                  placeholder="Tornillo hexagonal 1/4&#10;Tuerca galvanizada M8&#10;Arandela plana 3/8..."
                  value={textoCapturado}
                  onChangeText={setTextoCapturado}
                  textAlignVertical="top"
                />

                <View style={styles.buttonRow}>
                  <Button mode="outlined" onPress={() => setInputMethod(null)}>Atrás</Button>
                  <Button mode="contained" onPress={procesarTexto}>Siguiente</Button>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* PASO 2: Editar líneas */}
          {step === 'edit' && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.stepTitle}>Revisa los productos ({lineasTexto.length})</Text>
                <Text style={styles.hint}>Edita o elimina antes de buscar</Text>

                {lineasTexto.map((linea, index) => (
                  <View key={index} style={styles.lineaRow}>
                    <TextInput
                      mode="outlined"
                      value={linea}
                      onChangeText={(v) => editarLinea(index, v)}
                      style={styles.lineaInput}
                      dense
                    />
                    <IconButton icon="delete" size={20} iconColor="#d32f2f" onPress={() => eliminarLinea(index)} />
                  </View>
                ))}

                <Divider style={{ marginVertical: 16 }} />

                <View style={styles.buttonRow}>
                  <Button mode="outlined" onPress={() => setStep('input')}>Atrás</Button>
                  <Button mode="contained" onPress={buscarMatches} loading={loading}>
                    Buscar Similares
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* PASO 3: Loading */}
          {step === 'match' && loading && (
            <Card style={styles.card}>
              <Card.Content style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Analizando productos...</Text>
              </Card.Content>
            </Card>
          )}

          {/* PASO 4: Resultados */}
          {step === 'result' && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.stepTitle}>Productos encontrados</Text>
                <Text style={styles.hint}>La IA aprende de cada corrección que hagas</Text>

                {matches.map((match, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.matchCard,
                      match.sospechoso && !match.producto_sugerido && styles.matchNoEntendido,
                      match.sospechoso && match.producto_sugerido && styles.matchSospechoso,
                      match.aprendido && styles.matchAprendido,
                      match.modificado && styles.matchModificado
                    ]}
                  >
                    <Text style={styles.matchOriginal}>Buscaste: "{match.nombre_original}"</Text>
                    
                    {editandoIndex === index ? (
                      // Modo edición: buscar otro producto
                      <View style={styles.editarContainer}>
                        <Text style={styles.editarTitulo}>Busca el producto correcto:</Text>
                        <Searchbar
                          placeholder="Escribe para buscar..."
                          onChangeText={buscarProductoParaCambiar}
                          value={busquedaProducto}
                          style={styles.searchbarEdit}
                          autoFocus
                        />
                        {resultadosBusqueda.length > 0 && (
                          <View style={styles.resultadosEdit}>
                            <FlatList
                              data={resultadosBusqueda}
                              keyExtractor={(item) => item._id}
                              renderItem={({ item }) => (
                                <TouchableOpacity 
                                  style={styles.resultadoItem}
                                  onPress={() => cambiarProducto(index, item)}
                                >
                                  <Text style={styles.resultadoNombre} numberOfLines={2}>{item.nombre}</Text>
                                  <Text style={styles.resultadoPrecio}>${item.costo_base.toLocaleString()}</Text>
                                </TouchableOpacity>
                              )}
                              style={{ maxHeight: 200 }}
                              keyboardShouldPersistTaps="handled"
                              nestedScrollEnabled
                            />
                          </View>
                        )}
                        <View style={styles.editarBotones}>
                          <Button mode="text" onPress={() => { setEditandoIndex(null); setBusquedaProducto(''); setResultadosBusqueda([]); }}>
                            Cancelar
                          </Button>
                          <Button mode="text" onPress={() => saltarProducto(index)} textColor="#d32f2f">
                            Omitir este
                          </Button>
                        </View>
                      </View>
                    ) : (
                      // Modo normal: mostrar resultado
                      <>
                        {match.producto_sugerido ? (
                          match.sospechoso && !match.aprendido ? (
                            // Producto encontrado pero con baja confianza
                            <View style={styles.sospechosoContainer}>
                              <Text style={styles.sospechosoTitulo}>
                                🤔 No estoy seguro... ¿Es este?
                              </Text>
                              <Text style={styles.matchSugerido}>{match.producto_sugerido.nombre}</Text>
                              <Text style={styles.matchPrecio}>
                                ${match.producto_sugerido.costo_base.toLocaleString()}
                              </Text>
                              <Text style={styles.matchScore}>
                                Similitud: {Math.round(match.score * 100)}%
                              </Text>
                              <View style={styles.sospechosoButtons}>
                                <Button 
                                  mode="contained" 
                                  compact 
                                  onPress={() => confirmarSugerencia(index)}
                                  buttonColor="#4caf50"
                                  icon="check"
                                >
                                  Sí, es correcto
                                </Button>
                                <Button 
                                  mode="outlined" 
                                  compact 
                                  onPress={() => setEditandoIndex(index)}
                                  icon="magnify"
                                >
                                  No, buscar otro
                                </Button>
                              </View>
                            </View>
                          ) : (
                            // Producto encontrado con buena confianza
                            <>
                              <Text style={styles.matchSugerido}>
                                {match.aprendido ? '✓ ' : '→ '}{match.producto_sugerido.nombre}
                              </Text>
                              <Text style={styles.matchPrecio}>
                                ${match.producto_sugerido.costo_base.toLocaleString()}
                              </Text>
                              <View style={styles.matchInfoRow}>
                                <Text style={styles.matchScore}>
                                  {match.aprendido ? '✓ Aprendido' : `${Math.round(match.score * 100)}% similitud`}
                                </Text>
                                <Button 
                                  mode="text" 
                                  compact 
                                  onPress={() => setEditandoIndex(index)}
                                  icon="pencil"
                                >
                                  Cambiar
                                </Button>
                              </View>
                            </>
                          )
                        ) : (
                          // No encontrado
                          <View style={styles.noEntendidoContainer}>
                            <Text style={styles.noEntendidoTitulo}>
                              ❌ No entendí "{match.nombre_original}"
                            </Text>
                            <Text style={styles.noEntendidoDesc}>
                              ¿Podrías buscar el producto correcto? La IA aprenderá de tu corrección.
                            </Text>
                            <View style={styles.noEntendidoButtons}>
                              <Button 
                                mode="contained" 
                                onPress={() => setEditandoIndex(index)}
                                icon="magnify"
                              >
                                Buscar producto
                              </Button>
                              <Button 
                                mode="text" 
                                onPress={() => saltarProducto(index)}
                                textColor="#666"
                              >
                                Omitir
                              </Button>
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                ))}

                <Divider style={{ marginVertical: 16 }} />

                <View style={styles.buttonRow}>
                  <Button mode="outlined" onPress={() => setStep('edit')}>Volver a editar</Button>
                  <Button 
                    mode="contained" 
                    onPress={confirmarSeleccion}
                    disabled={matches.filter(m => m.producto_sugerido).length === 0}
                  >
                    Agregar ({matches.filter(m => m.producto_sugerido).length})
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}
        </ScrollView>

        {/* Modal de cámara */}
        <Modal visible={cameraVisible} animationType="slide">
          <View style={styles.cameraContainer}>
            <CameraView 
              style={styles.camera} 
              facing="back"
              ref={cameraRef}
            >
              <View style={styles.cameraControls}>
                <Button mode="contained" onPress={() => setCameraVisible(false)} buttonColor="#d32f2f">
                  Cancelar
                </Button>
                <Button mode="contained" onPress={capturarImagen}>
                  Capturar
                </Button>
              </View>
            </CameraView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: '#6200ee',
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 16 },
  card: { borderRadius: 12, marginBottom: 16 },
  stepTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  hint: { fontSize: 13, color: '#666', marginBottom: 16 },
  methodButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
  },
  methodInfo: { flex: 1, marginLeft: 8 },
  methodTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  methodDesc: { fontSize: 13, color: '#666' },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  lineaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lineaInput: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  matchCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  matchSospechoso: { borderColor: '#ff9800', backgroundColor: '#fff3e0' },
  matchNoEntendido: { borderColor: '#d32f2f', backgroundColor: '#ffebee' },
  matchAprendido: { borderColor: '#4caf50', backgroundColor: '#e8f5e9' },
  matchModificado: { borderColor: '#2196f3', backgroundColor: '#e3f2fd' },
  matchOriginal: { fontSize: 12, color: '#666', marginBottom: 8, fontStyle: 'italic' },
  matchSugerido: { fontSize: 15, fontWeight: '600', color: '#333' },
  matchPrecio: { fontSize: 14, color: '#2e7d32', marginTop: 4 },
  matchScore: { fontSize: 12, color: '#666' },
  matchInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  matchNoEncontrado: { fontSize: 14, color: '#d32f2f', fontStyle: 'italic', marginBottom: 8 },
  editarContainer: { marginTop: 8 },
  editarTitulo: { fontSize: 13, color: '#333', marginBottom: 8, fontWeight: '500' },
  editarBotones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  searchbarEdit: { marginBottom: 8, elevation: 0 },
  resultadosEdit: { backgroundColor: '#f5f5f5', borderRadius: 8, marginBottom: 8 },
  resultadoItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  resultadoNombre: { fontSize: 14, color: '#333' },
  resultadoPrecio: { fontSize: 12, color: '#2e7d32', marginTop: 2 },
  // Estilos para "no entendido"
  noEntendidoContainer: { marginTop: 4 },
  noEntendidoTitulo: { fontSize: 15, fontWeight: '600', color: '#d32f2f', marginBottom: 8 },
  noEntendidoDesc: { fontSize: 13, color: '#666', marginBottom: 12 },
  noEntendidoButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Estilos para "sospechoso"
  sospechosoContainer: { marginTop: 4 },
  sospechosoTitulo: { fontSize: 14, fontWeight: '600', color: '#ff9800', marginBottom: 8 },
  sospechosoButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraControls: { 
    position: 'absolute', 
    bottom: 40, 
    left: 20, 
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
