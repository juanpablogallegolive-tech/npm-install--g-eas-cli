import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Card,
  Searchbar,
  List,
  Divider,
  Portal,
  Modal,
} from 'react-native-paper';
import { cotizacionesApi, productosApi } from '../services/api';
import { Cotizacion, ItemCotizacion, Producto } from '../types/types';
import { format } from 'date-fns';

export default function QuotesScreen() {
  const [nombreCliente, setNombreCliente] = useState('');
  const [items, setItems] = useState<Array<{
    cantidad: string;
    producto: Producto | null;
    subtotal: number;
  }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Búsqueda de productos
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null);
  
  // Cotizaciones guardadas
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

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
    newItems[index].cantidad = cantidad;
    
    // Calcular subtotal
    const cant = parseFloat(cantidad) || 0;
    const precio = newItems[index].producto?.costo_base || 0;
    newItems[index].subtotal = cant * precio;
    
    setItems(newItems);
  };

  const buscarProducto = async (index: number, query: string) => {
    setSearchingIndex(index);
    setSearchQuery(query);
    
    if (query.length > 1) {
      try {
        const response = await productosApi.search(query);
        setSearchResults(response.data);
        setShowResults(true);
      } catch (error) {
        console.error('Error en búsqueda:', error);
      }
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const seleccionarProducto = (index: number, producto: Producto) => {
    const newItems = [...items];
    newItems[index].producto = producto;
    
    // Calcular subtotal
    const cant = parseFloat(newItems[index].cantidad) || 0;
    newItems[index].subtotal = cant * producto.costo_base;
    
    setItems(newItems);
    setShowResults(false);
    setSearchQuery('');
    setSearchingIndex(null);
  };

  const calcularTotal = () => {
    const suma = items.reduce((acc, item) => acc + item.subtotal, 0);
    setTotal(suma);
  };

  const limpiar = () => {
    setNombreCliente('');
    setItems([]);
    setTotal(0);
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

      await cotizacionesApi.create({
        nombre_cliente: nombreCliente || 'Sin nombre',
        items: itemsCotizacion,
        total,
      });

      Alert.alert('Éxito', 'Cotización guardada');
      limpiar();
      loadCotizaciones();
    } catch (error) {
      console.error('Error al guardar cotización:', error);
      Alert.alert('Error', 'No se pudo guardar la cotización');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'Fecha inválida';
    }
  };

  const verCotizaciones = () => {
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
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
              <IconButton icon="plus" size={24} onPress={agregarFila} />
            </View>

            {items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Item {index + 1}</Text>
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() => eliminarFila(index)}
                  />
                </View>

                <TextInput
                  mode="outlined"
                  label="Cantidad"
                  value={item.cantidad}
                  onChangeText={(text) => actualizarCantidad(index, text)}
                  keyboardType="numeric"
                  style={styles.inputSmall}
                />

                <Searchbar
                  placeholder="Buscar producto..."
                  onChangeText={(query) => buscarProducto(index, query)}
                  value={searchingIndex === index ? searchQuery : (item.producto?.nombre || '')}
                  style={styles.searchbar}
                />

                {showResults && searchingIndex === index && searchResults.length > 0 && (
                  <View style={styles.resultsContainer}>
                    {searchResults.slice(0, 5).map((producto) => (
                      <List.Item
                        key={producto._id}
                        title={producto.nombre}
                        description={`$${producto.costo_base.toLocaleString()}`}
                        onPress={() => seleccionarProducto(index, producto)}
                        style={styles.resultItem}
                      />
                    ))}
                  </View>
                )}

                {item.producto && (
                  <View style={styles.subtotalBox}>
                    <Text style={styles.subtotalLabel}>Subtotal:</Text>
                    <Text style={styles.subtotalValor}>
                      ${item.subtotal.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {items.length === 0 && (
              <Text style={styles.emptyText}>No hay productos aún</Text>
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
          <Button
            mode="contained"
            onPress={guardarCotizacion}
            loading={loading}
            disabled={items.length === 0}
            style={styles.button}
          >
            Guardar Cotización
          </Button>
          
          <Button
            mode="outlined"
            onPress={limpiar}
            style={styles.button}
          >
            Limpiar
          </Button>
          
          <Button
            mode="outlined"
            onPress={verCotizaciones}
            style={styles.button}
          >
            Ver Cotizaciones Guardadas
          </Button>
        </View>
      </ScrollView>

      {/* Modal de Cotizaciones */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
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
                    <Text style={styles.cotizacionCliente}>
                      {item.nombre_cliente || 'Sin nombre'}
                    </Text>
                    <Text style={styles.cotizacionFecha}>
                      {formatDate(item.fecha)}
                    </Text>
                    <Text style={styles.cotizacionItems}>
                      {item.items.length} productos
                    </Text>
                    <Text style={styles.cotizacionTotal}>
                      Total: ${item.total.toLocaleString()}
                    </Text>
                  </Card.Content>
                </Card>
              )}
            />
          )}

          <Button
            mode="contained"
            onPress={() => setModalVisible(false)}
            style={styles.modalButton}
          >
            Cerrar
          </Button>
        </Modal>
      </Portal>
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
  input: {
    backgroundColor: '#fff',
  },
  inputSmall: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchbar: {
    marginBottom: 8,
  },
  resultsContainer: {
    maxHeight: 150,
    backgroundColor: '#fff',
    borderRadius: 4,
    marginBottom: 8,
  },
  resultItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  subtotalBox: {
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtotalLabel: {
    fontSize: 14,
    color: '#1565c0',
  },
  subtotalValor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0d47a1',
  },
  totalBox: {
    backgroundColor: '#e8f5e9',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  totalValor: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 8,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  cotizacionCard: {
    marginBottom: 12,
  },
  cotizacionCliente: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cotizacionFecha: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  cotizacionItems: {
    fontSize: 14,
    color: '#666',
  },
  cotizacionTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginTop: 4,
  },
  modalButton: {
    marginTop: 16,
  },
});
