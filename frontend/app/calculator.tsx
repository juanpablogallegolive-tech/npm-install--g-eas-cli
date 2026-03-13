import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Searchbar,
  List,
  Divider,
  IconButton,
  ActivityIndicator,
  Menu,
  Card,
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
  const [menuVisible, setMenuVisible] = useState(false);
  
  const [valoresOperaciones, setValoresOperaciones] = useState<Record<string, string>>({});
  const [clientes, setClientes] = useState<Array<{
    nombre: string;
    porcentaje_ganancia: string;
    comentario: string;
    precio_final: number;
  }>>([]);
  
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    loadFlujos();
  }, []);

  const loadFlujos = async () => {
    try {
      const response = await flujosApi.getAll();
      setFlujos(response.data);
    } catch (error) {
      console.error('Error al cargar flujos:', error);
    }
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
    
    // Si el producto tiene un flujo, cargarlo
    if (producto.flujo_id) {
      const flujo = flujos.find(f => f._id === producto.flujo_id);
      if (flujo) {
        setSelectedFlujo(flujo);
        // Inicializar valores de operaciones en 0
        const valores: Record<string, string> = {};
        flujo.operaciones.forEach(op => {
          valores[op.nombre] = '0';
        });
        setValoresOperaciones(valores);
      }
    }
  };

  const selectFlujo = (flujo: Flujo) => {
    setSelectedFlujo(flujo);
    setMenuVisible(false);
    
    // Inicializar valores de operaciones
    const valores: Record<string, string> = {};
    flujo.operaciones.forEach(op => {
      valores[op.nombre] = '0';
    });
    setValoresOperaciones(valores);
    
    // Limpiar clientes
    setClientes([]);
  };

  const addCliente = () => {
    setClientes([...clientes, {
      nombre: '',
      porcentaje_ganancia: '0',
      comentario: '',
      precio_final: 0,
    }]);
  };

  const removeCliente = (index: number) => {
    setClientes(clientes.filter((_, i) => i !== index));
  };

  const updateCliente = (index: number, field: string, value: string) => {
    const newClientes = [...clientes];
    newClientes[index] = { ...newClientes[index], [field]: value };
    setClientes(newClientes);
  };

  const calcular = async () => {
    if (!selectedProduct || !selectedFlujo) {
      Alert.alert('Error', 'Selecciona un producto y un flujo');
      return;
    }

    if (clientes.length === 0) {
      Alert.alert('Error', 'Agrega al menos un cliente');
      return;
    }

    try {
      setCalculando(true);
      
      // Convertir valores a números
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

    } catch (error) {
      console.error('Error al calcular:', error);
      Alert.alert('Error', 'No se pudo calcular el precio');
    } finally {
      setCalculando(false);
    }
  };

  const guardar = async () => {
    if (!selectedProduct || !selectedFlujo || clientes.length === 0) {
      Alert.alert('Error', 'Completa todos los campos antes de guardar');
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
    >
      <ScrollView style={styles.scrollView}>
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
                {searchResults.map((producto) => (
                  <List.Item
                    key={producto._id}
                    title={producto.nombre}
                    description={`$${producto.costo_base.toLocaleString()}`}
                    onPress={() => selectProduct(producto)}
                    style={styles.resultItem}
                  />
                ))}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Selector de Flujo */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Flujo de Cálculo</Text>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setMenuVisible(true)}
                  icon="chevron-down"
                >
                  {selectedFlujo ? selectedFlujo.nombre : 'Seleccionar flujo'}
                </Button>
              }
            >
              {flujos.map((flujo) => (
                <Menu.Item
                  key={flujo._id}
                  onPress={() => selectFlujo(flujo)}
                  title={flujo.nombre}
                />
              ))}
            </Menu>
          </Card.Content>
        </Card>

        {/* Campos Dinámicos según Flujo */}
        {selectedFlujo && selectedFlujo.operaciones.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Valores de Operaciones</Text>
              {selectedFlujo.operaciones.map((operacion) => (
                <View key={operacion.nombre} style={styles.inputRow}>
                  <Text style={styles.inputLabel}>
                    {operacion.nombre} ({operacion.tipo_operacion} - {operacion.tipo_valor})
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
              <IconButton icon="plus" size={24} onPress={addCliente} />
            </View>
            
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
                  label="Nombre"
                  value={cliente.nombre}
                  onChangeText={(text) => updateCliente(index, 'nombre', text)}
                  style={styles.inputSmall}
                />
                
                <TextInput
                  mode="outlined"
                  label="Ganancia (%)"
                  keyboardType="numeric"
                  value={cliente.porcentaje_ganancia}
                  onChangeText={(text) => updateCliente(index, 'porcentaje_ganancia', text)}
                  style={styles.inputSmall}
                />
                
                <TextInput
                  mode="outlined"
                  label="Comentario"
                  value={cliente.comentario}
                  onChangeText={(text) => updateCliente(index, 'comentario', text)}
                  style={styles.inputSmall}
                  multiline
                />
                
                {cliente.precio_final > 0 && (
                  <View style={styles.resultadoBox}>
                    <Text style={styles.resultadoLabel}>Precio Final:</Text>
                    <Text style={styles.resultadoValor}>
                      ${cliente.precio_final.toLocaleString()}
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
            disabled={!selectedProduct || !selectedFlujo || clientes.length === 0}
            style={styles.button}
          >
            Calcular
          </Button>
          
          <Button
            mode="contained"
            onPress={guardar}
            loading={loading}
            disabled={clientes.length === 0 || !clientes[0]?.precio_final}
            style={styles.button}
          >
            Guardar
          </Button>
        </View>
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
  card: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchbar: {
    marginBottom: 8,
  },
  loader: {
    marginVertical: 8,
  },
  resultsContainer: {
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  resultItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  inputRow: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
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
  },
  resultadoValor: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 8,
  },
});
