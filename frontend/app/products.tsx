import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  Text,
  Searchbar,
  FAB,
  Card,
  ActivityIndicator,
  Portal,
  Modal,
  TextInput,
  Button,
} from 'react-native-paper';
import { productosApi } from '../services/api';
import { Producto } from '../types/types';

export default function ProductsScreen() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [displayedProductos, setDisplayedProductos] = useState<Producto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  
  const [nombre, setNombre] = useState('');
  const [costoOriginal, setCostoOriginal] = useState('');
  const [comentarios, setComentarios] = useState('');

  useEffect(() => {
    loadProductos();
  }, []);

  useEffect(() => {
    filterProductos();
  }, [searchQuery, productos]);

  const loadProductos = async () => {
    try {
      setLoading(true);
      const response = await productosApi.getAll();
      setProductos(response.data);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const filterProductos = () => {
    if (searchQuery.trim() === '') {
      setDisplayedProductos(productos);
    } else {
      const filtered = productos.filter((p) =>
        p.nombre.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setDisplayedProductos(filtered);
    }
  };

  const openModal = (producto?: Producto) => {
    if (producto) {
      setEditingProduct(producto);
      setNombre(producto.nombre);
      setCostoOriginal(producto.costo_original.toString());
      setComentarios(producto.comentarios || '');
    } else {
      setEditingProduct(null);
      setNombre('');
      setCostoOriginal('');
      setComentarios('');
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingProduct(null);
  };

  const guardarProducto = async () => {
    if (!nombre.trim() || !costoOriginal.trim()) {
      Alert.alert('Error', 'Completa todos los campos obligatorios');
      return;
    }

    const costo = parseFloat(costoOriginal);
    if (isNaN(costo) || costo < 0) {
      Alert.alert('Error', 'Ingresa un costo válido');
      return;
    }

    try {
      setLoading(true);
      const productoData = {
        nombre,
        costo_original: costo,
        costo_base: costo,
        comentarios,
      };

      if (editingProduct) {
        await productosApi.update(editingProduct._id, productoData);
        Alert.alert('Éxito', 'Producto actualizado');
      } else {
        await productosApi.create(productoData);
        Alert.alert('Éxito', 'Producto creado');
      }

      closeModal();
      loadProductos();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      Alert.alert('Error', 'No se pudo guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  const renderProducto = ({ item }: { item: Producto }) => (
    <Card style={styles.card} onPress={() => openModal(item)}>
      <Card.Content>
        <Text style={styles.nombre}>{item.nombre}</Text>
        <Text style={styles.costo}>Costo base: ${item.costo_base.toLocaleString()}</Text>
        {item.comentarios && (
          <Text style={styles.comentario}>{item.comentarios}</Text>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar productos..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {loading && productos.length === 0 ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={displayedProductos}
          renderItem={renderProducto}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay productos</Text>
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => openModal()}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={closeModal}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>
            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
          </Text>
          
          <TextInput
            mode="outlined"
            label="Nombre *"
            value={nombre}
            onChangeText={setNombre}
            style={styles.input}
          />
          
          <TextInput
            mode="outlined"
            label="Costo Original *"
            value={costoOriginal}
            onChangeText={setCostoOriginal}
            keyboardType="numeric"
            style={styles.input}
          />
          
          <TextInput
            mode="outlined"
            label="Comentarios"
            value={comentarios}
            onChangeText={setComentarios}
            multiline
            numberOfLines={3}
            style={styles.input}
          />

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={closeModal}
              style={styles.modalButton}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={guardarProducto}
              loading={loading}
              style={styles.modalButton}
            >
              Guardar
            </Button>
          </View>
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
  searchbar: {
    margin: 16,
  },
  loader: {
    marginTop: 50,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    marginBottom: 12,
  },
  nombre: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  costo: {
    fontSize: 14,
    color: '#666',
  },
  comentario: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 50,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ee',
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
});
