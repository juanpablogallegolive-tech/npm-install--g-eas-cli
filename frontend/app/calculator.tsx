import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
  FlatList,
  Keyboard,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Searchbar,
  IconButton,
  ActivityIndicator,
  Card,
  Divider,
} from 'react-native-paper';
import { productosApi, calcularPrecio, calculosApi } from '../services/api';
import { Producto, Flujo, Cliente, Calculo } from '../types/types';
import { useStore } from '../store/store';

export default function CalculatorScreen() {
  const { flujos, fetchFlujos, flujosVersion } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  
  // Costo base editable
  const [costoBaseEditable, setCostoBaseEditable] = useState('0');
  
  const [selectedFlujo, setSelectedFlujo] = useState<Flujo | null>(null);
  const [modalFlujoVisible, setModalFlujoVisible] = useState(false);
  
  // Modal para cargar desde historial
  const [modalHistorialVisible, setModalHistorialVisible] = useState(false);
  const [historial, setHistorial] = useState<Calculo[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  
  const [valoresOperaciones, setValoresOperaciones] = useState<Record<string, string>>({});
  const [clientes, setClientes] = useState<Array<{
    nombre: string;
    porcentaje_ganancia: string;
    comentario: string;
    precio_final: number;
  }>>([]);
  
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchFlujos();
  }, []);

  useEffect(() => {
    if (flujos.length > 0 && !selectedFlujo) {
      setSelectedFlujo(flujos[0]);
      initOperaciones(flujos[0]);
    }
  }, [flujos]);

  useEffect(() => {
    if (selectedFlujo && flujos.length > 0) {
      const flujoActualizado = flujos.find(f => f._id === selectedFlujo._id);
      if (flujoActualizado) {
        const operacionesCambiaron = JSON.stringify(flujoActualizado.operaciones) !== JSON.stringify(selectedFlujo.operaciones);
        if (operacionesCambiaron) {
          setSelectedFlujo(flujoActualizado);
          initOperaciones(flujoActualizado);
        }
      } else {
        if (flujos.length > 0) {
          setSelectedFlujo(flujos[0]);
          initOperaciones(flujos[0]);
        } else {
          setSelectedFlujo(null);
          setValoresOperaciones({});
        }
      }
    }
  }, [flujos, flujosVersion]);

  const initOperaciones = (flujo: Flujo) => {
    const valores: Record<string, string> = {};
    flujo.operaciones.forEach(op => {
      valores[op.nombre] = '0';
    });
    setValoresOperaciones(valores);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 1) {
      try {
        setLoading(true);
        const response = await productosApi.search(query);
        setSearchResults(response.data);
        setShowResults(true);
      } catch (error) {
        console.error('Error en búsqueda:', error);
        Alert.alert('Error', 'No se pudo realizar la búsqueda');
      } finally {
        setLoading(false);
      }
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const selectProduct = (producto: Producto) => {
    setSelectedProduct(producto);
    setSearchQuery(producto.nombre);
    setCostoBaseEditable(producto.costo_base.toString());
    setShowResults(false);
    Keyboard.dismiss();
    
    if (producto.flujo_id) {
      const flujo = flujos.find(f => f._id === producto.flujo_id);
      if (flujo) {
        setSelectedFlujo(flujo);
        initOperaciones(flujo);
      }
    }
  };

  const selectFlujo = (flujo: Flujo) => {
    setSelectedFlujo(flujo);
    setModalFlujoVisible(false);
    initOperaciones(flujo);
    // Reset precios al cambiar flujo
    setClientes(prev => prev.map(c => ({ ...c, precio_final: 0 })));
  };

  const addCliente = () => {
    const newClientes = [...clientes, {
      nombre: `Cliente ${clientes.length + 1}`,
      porcentaje_ganancia: '0',
      comentario: '',
      precio_final: 0,
    }];
    setClientes(newClientes);
    
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const removeCliente = (index: number) => {
    if (Platform.OS === 'web') {
      setClientes(clientes.filter((_, i) => i !== index));
    } else {
      Alert.alert(
        'Confirmar',
        '¿Eliminar este cliente?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => setClientes(clientes.filter((_, i) => i !== index))
          },
        ]
      );
    }
  };

  const updateCliente = (index: number, field: string, value: string) => {
    const newClientes = [...clientes];
    newClientes[index] = { ...newClientes[index], [field]: value, precio_final: 0 };
    setClientes(newClientes);
  };

  const calcular = async () => {
    const costoBase = parseFloat(costoBaseEditable) || 0;
    
    if (costoBase <= 0) {
      Alert.alert('Error', 'Ingresa un costo base válido');
      return;
    }
    
    if (!selectedFlujo) {
      Alert.alert('Error', 'Selecciona un flujo de cálculo');
      return;
    }

    if (clientes.length === 0) {
      Alert.alert('Error', 'Agrega al menos un cliente');
      return;
    }

    const clientesSinNombre = clientes.filter(c => !c.nombre.trim());
    if (clientesSinNombre.length > 0) {
      Alert.alert('Error', 'Todos los clientes deben tener un nombre');
      return;
    }

    try {
      setCalculando(true);
      
      const valoresNum: Record<string, number> = {};
      Object.keys(valoresOperaciones).forEach(key => {
        valoresNum[key] = parseFloat(valoresOperaciones[key]) || 0;
      });

      const clientesData = clientes.map(c => ({
        nombre: c.nombre || 'Cliente',
        porcentaje_ganancia: parseFloat(c.porcentaje_ganancia) || 0,
        comentario: c.comentario,
      }));

      const response = await calcularPrecio({
        costo_base: costoBase,
        flujo_id: selectedFlujo._id,
        valores_operaciones: valoresNum,
        clientes: clientesData,
      });

      const newClientes = [...clientes];
      response.data.resultados.forEach((resultado, index) => {
        if (newClientes[index]) {
          newClientes[index].precio_final = resultado.precio_final;
        }
      });
      setClientes(newClientes);
      
      Alert.alert('Éxito', 'Precios calculados correctamente');

    } catch (error) {
      console.error('Error al calcular:', error);
      Alert.alert('Error', 'No se pudo calcular el precio. Verifica los datos ingresados.');
    } finally {
      setCalculando(false);
    }
  };

  const guardar = async () => {
    const costoBase = parseFloat(costoBaseEditable) || 0;
    
    if (!selectedFlujo || clientes.length === 0) {
      Alert.alert('Error', 'Completa todos los campos antes de guardar');
      return;
    }

    if (clientes[0]?.precio_final === 0) {
      Alert.alert('Error', 'Calcula los precios antes de guardar');
      return;
    }

    try {
      setLoading(true);
      
      const valoresNum: Record<string, number> = {};
      Object.keys(valoresOperaciones).forEach(key => {
        valoresNum[key] = parseFloat(valoresOperaciones[key]) || 0;
      });

      const clientesGuardar: Cliente[] = clientes.map(c => ({
        nombre: c.nombre || 'Cliente',
        porcentaje_ganancia: parseFloat(c.porcentaje_ganancia) || 0,
        comentario: c.comentario,
        precio_final: c.precio_final,
      }));

      await calculosApi.create({
        nombre_producto: selectedProduct?.nombre || 'Producto personalizado',
        flujo_nombre: selectedFlujo.nombre,
        flujo_id: selectedFlujo._id,
        valores_operaciones: valoresNum,
        clientes: clientesGuardar,
        costo_base: costoBase,
      });

      Alert.alert('Éxito', 'Cálculo guardado en el historial');
      
      // Limpiar formulario
      limpiarFormulario();
      
    } catch (error) {
      console.error('Error al guardar:', error);
      Alert.alert('Error', 'No se pudo guardar el cálculo');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setSelectedProduct(null);
    setSearchQuery('');
    setCostoBaseEditable('0');
    setClientes([]);
    if (selectedFlujo) {
      initOperaciones(selectedFlujo);
    }
  };

  // Cargar historial
  const abrirHistorial = async () => {
    setModalHistorialVisible(true);
    setLoadingHistorial(true);
    try {
      const response = await calculosApi.getAll();
      setHistorial(response.data);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      Alert.alert('Error', 'No se pudo cargar el historial');
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Cargar cálculo desde historial
  const cargarDesdeHistorial = (calculo: Calculo) => {
    // Buscar el flujo
    const flujo = flujos.find(f => f._id === calculo.flujo_id || f.nombre === calculo.flujo_nombre);
    
    if (flujo) {
      setSelectedFlujo(flujo);
      
      // Cargar valores de operaciones
      const valores: Record<string, string> = {};
      flujo.operaciones.forEach(op => {
        valores[op.nombre] = (calculo.valores_operaciones[op.nombre] || 0).toString();
      });
      setValoresOperaciones(valores);
    }
    
    // Cargar datos del producto
    setSearchQuery(calculo.nombre_producto);
    setCostoBaseEditable(calculo.costo_base.toString());
    
    // Cargar clientes
    const clientesCargados = calculo.clientes.map(c => ({
      nombre: c.nombre,
      porcentaje_ganancia: c.porcentaje_ganancia.toString(),
      comentario: c.comentario || '',
      precio_final: c.precio_final,
    }));
    setClientes(clientesCargados);
    
    setModalHistorialVisible(false);
    Alert.alert('Cargado', 'Datos cargados desde el historial');
  };

  const handleRefreshFlujos = async () => {
    await fetchFlujos();
    Alert.alert('Actualizado', 'Lista de flujos actualizada');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
      >
        {/* Botón cargar desde historial */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.quickActions}>
              <Button
                mode="outlined"
                onPress={abrirHistorial}
                icon="history"
                compact
                style={styles.quickButton}
              >
                Cargar desde Historial
              </Button>
              <Button
                mode="outlined"
                onPress={limpiarFormulario}
                icon="eraser"
                compact
                style={styles.quickButton}
              >
                Limpiar
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Búsqueda de Producto */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Producto</Text>
            <Searchbar
              placeholder="Buscar producto..."
              onChangeText={handleSearch}
              value={searchQuery}
              style={styles.searchbar}
            />
            {loading && <ActivityIndicator style={styles.loader} />}
            {showResults && searchResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <ScrollView style={styles.resultsScroll} nestedScrollEnabled>
                  {searchResults.map((producto) => (
                    <TouchableOpacity
                      key={producto._id}
                      onPress={() => selectProduct(producto)}
                      style={styles.resultItem}
                    >
                      <Text style={styles.resultTitle}>{producto.nombre}</Text>
                      <Text style={styles.resultPrice}>${producto.costo_base.toLocaleString()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Costo Base Editable */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Costo Base</Text>
            <Text style={styles.helpText}>Puedes editar el costo base para este cálculo</Text>
            <TextInput
              mode="outlined"
              label="Costo Base ($)"
              value={costoBaseEditable}
              onChangeText={(text) => {
                setCostoBaseEditable(text);
                // Reset precios al cambiar costo
                setClientes(prev => prev.map(c => ({ ...c, precio_final: 0 })));
              }}
              keyboardType="numeric"
              style={styles.input}
              left={<TextInput.Affix text="$" />}
            />
          </Card.Content>
        </Card>

        {/* Selector de Flujo */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Flujo de Cálculo</Text>
              <IconButton
                icon="refresh"
                size={20}
                onPress={handleRefreshFlujos}
                style={styles.refreshButton}
              />
            </View>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setModalFlujoVisible(true)}
            >
              <Text style={styles.dropdownText}>
                {selectedFlujo ? selectedFlujo.nombre : 'Seleccionar flujo'}
              </Text>
              <IconButton icon="chevron-down" size={20} style={styles.dropdownIcon} />
            </TouchableOpacity>
            <Text style={styles.flujosCount}>
              {flujos.length} flujo(s) disponible(s)
            </Text>
          </Card.Content>
        </Card>

        {/* Campos Dinámicos según Flujo */}
        {selectedFlujo && selectedFlujo.operaciones.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Valores de Operaciones</Text>
              {selectedFlujo.operaciones.map((operacion, index) => (
                <View key={`${operacion.nombre}-${index}`} style={styles.inputRow}>
                  <Text style={styles.inputLabel}>
                    {operacion.nombre}
                  </Text>
                  <Text style={styles.inputSubLabel}>
                    {operacion.tipo_operacion} - {operacion.tipo_valor}
                  </Text>
                  <TextInput
                    mode="outlined"
                    keyboardType="numeric"
                    value={valoresOperaciones[operacion.nombre] || '0'}
                    onChangeText={(text) => {
                      setValoresOperaciones({
                        ...valoresOperaciones,
                        [operacion.nombre]: text,
                      });
                      // Reset precios al cambiar valores
                      setClientes(prev => prev.map(c => ({ ...c, precio_final: 0 })));
                    }}
                    style={styles.input}
                    dense
                  />
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Clientes */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Clientes</Text>
              <Button 
                mode="contained" 
                onPress={addCliente}
                icon="plus"
                compact
              >
                Agregar
              </Button>
            </View>
            
            {clientes.length === 0 && (
              <Text style={styles.emptyText}>No hay clientes. Presiona Agregar para comenzar.</Text>
            )}
            
            {clientes.map((cliente, index) => (
              <View key={index} style={styles.clienteCard}>
                <View style={styles.clienteHeader}>
                  <Text style={styles.clienteTitle}>Cliente {index + 1}</Text>
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() => removeCliente(index)}
                  />
                </View>
                
                <TextInput
                  mode="outlined"
                  label="Nombre *"
                  value={cliente.nombre}
                  onChangeText={(text) => updateCliente(index, 'nombre', text)}
                  style={styles.inputSmall}
                  dense
                />
                
                <TextInput
                  mode="outlined"
                  label="Ganancia (%)"
                  keyboardType="numeric"
                  value={cliente.porcentaje_ganancia}
                  onChangeText={(text) => updateCliente(index, 'porcentaje_ganancia', text)}
                  style={styles.inputSmall}
                  dense
                />
                
                <TextInput
                  mode="outlined"
                  label="Comentario"
                  value={cliente.comentario}
                  onChangeText={(text) => updateCliente(index, 'comentario', text)}
                  style={styles.inputSmall}
                  multiline
                  numberOfLines={2}
                  dense
                />
                
                {cliente.precio_final > 0 && (
                  <View style={styles.resultadoBox}>
                    <Text style={styles.resultadoLabel}>Precio Final:</Text>
                    <Text style={styles.resultadoValor}>
                      ${cliente.precio_final.toLocaleString('es-CO')}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Botones */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={calcular}
            loading={calculando}
            disabled={parseFloat(costoBaseEditable) <= 0 || !selectedFlujo || clientes.length === 0 || calculando}
            style={styles.button}
            icon="calculator"
          >
            Calcular
          </Button>
          
          <Button
            mode="contained"
            onPress={guardar}
            loading={loading}
            disabled={clientes.length === 0 || !clientes[0]?.precio_final || loading}
            style={styles.button}
            icon="content-save"
          >
            Guardar en Historial
          </Button>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Modal para seleccionar flujo */}
      <Modal
        visible={modalFlujoVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalFlujoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Flujo ({flujos.length})</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setModalFlujoVisible(false)}
              />
            </View>
            <Divider />
            <FlatList
              data={flujos}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedFlujo?._id === item._id && styles.modalItemSelected
                  ]}
                  onPress={() => selectFlujo(item)}
                >
                  <View style={styles.modalItemContent}>
                    <Text style={[
                      styles.modalItemText,
                      selectedFlujo?._id === item._id && styles.modalItemTextSelected
                    ]}>
                      {item.nombre}
                    </Text>
                    <Text style={styles.modalItemSubtext}>
                      {item.operaciones.length} operaciones
                    </Text>
                  </View>
                  {selectedFlujo?._id === item._id && (
                    <IconButton icon="check" size={20} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay flujos creados.</Text>
                  <Text style={styles.emptySubText}>Ve a la pestaña Flujos para crear uno.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal para cargar desde historial */}
      <Modal
        visible={modalHistorialVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalHistorialVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cargar desde Historial</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setModalHistorialVisible(false)}
              />
            </View>
            <Divider />
            {loadingHistorial ? (
              <ActivityIndicator size="large" style={styles.loader} />
            ) : (
              <FlatList
                data={historial}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historialItem}
                    onPress={() => cargarDesdeHistorial(item)}
                  >
                    <View style={styles.historialInfo}>
                      <Text style={styles.historialProducto}>{item.nombre_producto}</Text>
                      <Text style={styles.historialFlujo}>Flujo: {item.flujo_nombre}</Text>
                      <Text style={styles.historialCosto}>Costo Base: ${item.costo_base.toLocaleString()}</Text>
                      <Text style={styles.historialClientes}>
                        {item.clientes.length} cliente(s) - Precio: ${item.clientes[0]?.precio_final.toLocaleString() || 0}
                      </Text>
                    </View>
                    <IconButton icon="chevron-right" size={20} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No hay cálculos guardados.</Text>
                    <Text style={styles.emptySubText}>Guarda un cálculo primero.</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
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
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  searchbar: {
    marginBottom: 8,
    elevation: 0,
  },
  loader: {
    marginVertical: 8,
  },
  resultsContainer: {
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
  },
  resultsScroll: {
    maxHeight: 200,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  resultPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownIcon: {
    margin: 0,
  },
  refreshButton: {
    margin: 0,
  },
  flujosCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputRow: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
    color: '#333',
  },
  inputSubLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
  },
  inputSmall: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  clienteCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clienteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clienteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  resultadoBox: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 4,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultadoLabel: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
  },
  resultadoValor: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 16,
    fontSize: 14,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 6,
  },
  bottomSpace: {
    height: 32,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemSelected: {
    backgroundColor: '#f0e6ff',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemTextSelected: {
    color: '#6200ee',
    fontWeight: '500',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  // Historial styles
  historialItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historialInfo: {
    flex: 1,
  },
  historialProducto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  historialFlujo: {
    fontSize: 13,
    color: '#6200ee',
    marginTop: 2,
  },
  historialCosto: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  historialClientes: {
    fontSize: 12,
    color: '#2e7d32',
    marginTop: 2,
  },
});
