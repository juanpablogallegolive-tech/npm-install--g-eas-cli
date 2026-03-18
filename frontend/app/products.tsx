import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Searchbar,
  FAB,
  IconButton,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { productosApi } from '../services/api';
import { Producto } from '../types/types';

export default function ProductsScreen() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [costoOriginal, setCostoOriginal] = useState('');
  const [costoBase, setCostoBase] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProductos();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = productos.filter(p =>
        p.nombre.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProductos(filtered);
    } else {
      setFilteredProductos(productos);
    }
  }, [searchQuery, productos]);

  const loadProductos = async () => {
    try {
      setLoading(true);
      const response = await productosApi.getAll();
      setProductos(response.data);
      setFilteredProductos(response.data);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setNombre('');
    setCostoOriginal('');
    setCostoBase('');
    setComentarios('');
    setModalVisible(true);
  };

  const openEditProduct = (producto: Producto) => {
    setEditingProduct(producto);
    setNombre(producto.nombre);
    setCostoOriginal(producto.costo_original.toString());
    setCostoBase(producto.costo_base.toString());
    setComentarios(producto.comentarios || '');
    setModalVisible(true);
  };

  const saveProduct = async () => {
    if (!nombre.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el producto');
      return;
    }

    const costoOrig = parseFloat(costoOriginal) || 0;
    const costoB = parseFloat(costoBase) || costoOrig;

    try {
      setSaving(true);

      if (editingProduct) {
        // Check if price changed
        const precioAnterior = editingProduct.costo_base;
        let nuevoComentario = comentarios;
        
        if (precioAnterior !== costoB) {
          nuevoComentario = `${comentarios}\n[Precio actualizado: $${precioAnterior} -> $${costoB} el ${new Date().toLocaleDateString()}]`;
        }

        await productosApi.update(editingProduct._id, {
          nombre: nombre.trim(),
          costo_original: costoOrig,
          costo_base: costoB,
          comentarios: nuevoComentario,
        });
        Alert.alert('Éxito', 'Producto actualizado');
      } else {
        await productosApi.create({
          nombre: nombre.trim(),
          costo_original: costoOrig,
          costo_base: costoB,
          comentarios,
        });
        Alert.alert('Éxito', 'Producto creado');
      }

      setModalVisible(false);
      loadProductos();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      Alert.alert('Error', 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = (producto: Producto) => {
    Alert.alert(
      'Confirmar',
      `¿Eliminar "${producto.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await productosApi.delete(producto._id);
              Alert.alert('Éxito', 'Producto eliminado');
              loadProductos();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el producto');
            }
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: Producto }) => {
    const hasUpdate = item.comentarios?.includes('[Precio actualizado') || 
                      item.comentarios?.includes('[Actualizado desde Excel');
    
    return (
      <Card style={styles.productCard}>
        <Card.Content>
          <View style={styles.productHeader}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.nombre}</Text>
              <Text style={styles.productPrice}>
                Costo Base: ${item.costo_base.toLocaleString('es-CO')}
              </Text>
              {item.costo_original !== item.costo_base && (
                <Text style={styles.productOriginal}>
                  Costo Original: ${item.costo_original.toLocaleString('es-CO')}
                </Text>
              )}
              {hasUpdate && (
                <View style={styles.updateBadge}>
                  <Text style={styles.updateText}>Precio actualizado</Text>
                </View>
              )}
            </View>
            <View style={styles.productActions}>
              <IconButton
                icon="pencil"
                size={20}
                onPress={() => openEditProduct(item)}
              />
              <IconButton
                icon="delete"
                size={20}
                iconColor="#d32f2f"
                onPress={() => deleteProduct(item)}
              />
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Buscar producto..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredProductos.length} producto(s) encontrado(s)
        </Text>
        <Button mode="text" onPress={loadProductos} icon="refresh">
          Recargar
        </Button>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredProductos}
          keyExtractor={(item) => item._id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay productos</Text>
              <Text style={styles.emptySubText}>Presiona + para agregar uno nuevo</Text>
            </View>
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openNewProduct}
      />

      {/* Modal for editing/creating product */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setModalVisible(false)}
              />
            </View>
            <Divider />
            
            <View style={styles.modalBody}>
              <TextInput
                mode="outlined"
                label="Nombre *"
                value={nombre}
                onChangeText={setNombre}
                style={styles.input}
              />
              
              <TextInput
                mode="outlined"
                label="Costo Original"
                value={costoOriginal}
                onChangeText={setCostoOriginal}
                keyboardType="numeric"
                style={styles.input}
              />
              
              <TextInput
                mode="outlined"
                label="Costo Base"
                value={costoBase}
                onChangeText={setCostoBase}
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

              <Button
                mode="contained"
                onPress={saveProduct}
                loading={saving}
                disabled={saving}
                style={styles.saveButton}
              >
                {editingProduct ? 'Actualizar' : 'Crear'}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    elevation: 0,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  loader: {
    marginTop: 50,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  productCard: {
    marginBottom: 8,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  productPrice: {
    fontSize: 14,
    color: '#6200ee',
    marginTop: 4,
  },
  productOriginal: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  updateBadge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  updateText: {
    fontSize: 11,
    color: '#ff9800',
    fontWeight: '500',
  },
  productActions: {
    flexDirection: 'row',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  emptySubText: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#6200ee',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  modalBody: {
    padding: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  saveButton: {
    marginTop: 8,
  },
});
