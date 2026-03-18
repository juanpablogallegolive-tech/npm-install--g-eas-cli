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
  AppState,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Searchbar,
  List,
  IconButton,
  ActivityIndicator,
  Card,
  Divider,
} from 'react-native-paper';
import { productosApi, flujosApi, calcularPrecio, calculosApi } from '../services/api';
import { Producto, Flujo, Cliente } from '../types/types';

export default function CalculatorScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  
  const [flujos, setFlujos] = useState<Flujo[]>([]);
  const [selectedFlujo, setSelectedFlujo] = useState<Flujo | null>(null);
  const [modalFlujoVisible, setModalFlujoVisible] = useState(false);
  
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
  const appState = useRef(AppState.currentState);

  // Cargar flujos al inicio
  useEffect(() => {
    loadFlujos();
  }, []);

  // Recargar flujos cuando la app vuelve a estar activa
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        loadFlujos();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Actualizar el flujo seleccionado cuando cambien los flujos
  useEffect(() => {
    if (selectedFlujo && flujos.length > 0) {
      const flujoActualizado = flujos.find(f => f._id === selectedFlujo._id);
      if (flujoActualizado) {
        const operacionesCambiaron = JSON.stringify(flujoActualizado.operaciones) !== JSON.stringify(selectedFlujo.operaciones);
        if (operacionesCambiaron) {
          setSelectedFlujo(flujoActualizado);
          initOperaciones(flujoActualizado);
        }
      }
    }
  }, [flujos]);

  const loadFlujos = async () => {
    try {
      const response = await flujosApi.getAll();
      setFlujos(response.data);
      if (response.data.length > 0 && !selectedFlujo) {
        // Seleccionar el primer flujo por defecto
        setSelectedFlujo(response.data[0]);
        initOperaciones(response.data[0]);
      }
    } catch (error) {
      console.error('Error al cargar flujos:', error);
      Alert.alert('Error', 'No se pudieron cargar los flujos');
    }
  };

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
    setShowResults(false);
    Keyboard.dismiss();
    
    // Si el producto tiene un flujo, cargarlo
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
    setClientes([]);
  };

  const addCliente = () => {
    const newClientes = [...clientes, {
      nombre: `Cliente ${clientes.length + 1}`,
      porcentaje_ganancia: '0',
      comentario: '',
      precio_final: 0,
    }];
    setClientes(newClientes);
    
    // Scroll al final después de agregar
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const removeCliente = (index: number) => {
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
  };

  const updateCliente = (index: number, field: string, value: string) => {
    const newClientes = [...clientes];
    newClientes[index] = { ...newClientes[index], [field]: value };
    setClientes(newClientes);
  };

  const calcular = async () => {
    if (!selectedProduct) {
      Alert.alert('Error', 'Selecciona un producto primero');
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

    // Validar que los clientes tengan nombre
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
        costo_base: selectedProduct.costo_original,
        flujo_id: selectedFlujo._id,
        valores_operaciones: valoresNum,
        clientes: clientesData,
      });

      // Actualizar precios finales
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
    if (!selectedProduct || !selectedFlujo || clientes.length === 0) {
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
        nombre_producto: selectedProduct.nombre,
        flujo_nombre: selectedFlujo.nombre,
        flujo_id: selectedFlujo._id,
        valores_operaciones: valoresNum,
        clientes: clientesGuardar,
        costo_base: selectedProduct.costo_base,
      });

      Alert.alert('Éxito', 'Cálculo guardado en el historial');
      
      // Limpiar formulario
      setSelectedProduct(null);
      setSearchQuery('');
      setClientes([]);
      setValoresOperaciones({});
      
    } catch (error) {
      console.error('Error al guardar:', error);
      Alert.alert('Error', 'No se pudo guardar el cálculo');
    } finally {
      setLoading(false);
    }
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

        {/* Selector de Flujo */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Flujo de Cálculo</Text>
              <IconButton
                icon="refresh"
                size={20}
                onPress={loadFlujos}
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
                    onChangeText={(text) => setValoresOperaciones({
                      ...valoresOperaciones,
                      [operacion.nombre]: text,
                    })}
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
            disabled={!selectedProduct || !selectedFlujo || clientes.length === 0 || calculando}
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
              <Text style={styles.modalTitle}>Seleccionar Flujo</Text>
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
                  <Text style={[
                    styles.modalItemText,
                    selectedFlujo?._id === item._id && styles.modalItemTextSelected
                  ]}>
                    {item.nombre}
                  </Text>
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
  modalItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  modalItemTextSelected: {
    color: '#6200ee',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
});
