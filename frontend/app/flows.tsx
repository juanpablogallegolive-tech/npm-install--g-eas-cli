import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Card,
  Menu,
  List,
  Divider,
} from 'react-native-paper';
import { flujosApi } from '../services/api';
import { Flujo, Operacion } from '../types/types';

export default function FlowsScreen() {
  const [flujos, setFlujos] = useState<Flujo[]>([]);
  const [selectedFlujo, setSelectedFlujo] = useState<Flujo | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [nombreFlujo, setNombreFlujo] = useState('');
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);

  useEffect(() => {
    loadFlujos();
  }, []);

  const loadFlujos = async () => {
    try {
      setLoading(true);
      const response = await flujosApi.getAll();
      setFlujos(response.data);
    } catch (error) {
      console.error('Error al cargar flujos:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectFlujo = (flujo: Flujo) => {
    setSelectedFlujo(flujo);
    setNombreFlujo(flujo.nombre);
    setOperaciones([...flujo.operaciones]);
    setMenuVisible(false);
  };

  const nuevoFlujo = () => {
    setSelectedFlujo(null);
    setNombreFlujo('Nuevo Flujo');
    setOperaciones([]);
  };

  const borrarFlujo = async () => {
    if (!selectedFlujo) {
      Alert.alert('Error', 'Selecciona un flujo para borrar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que quieres borrar este flujo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await flujosApi.delete(selectedFlujo._id);
              Alert.alert('Éxito', 'Flujo borrado');
              nuevoFlujo();
              loadFlujos();
            } catch (error) {
              Alert.alert('Error', 'No se pudo borrar el flujo');
            }
          },
        },
      ]
    );
  };

  const guardarFlujo = async () => {
    if (!nombreFlujo.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el flujo');
      return;
    }

    try {
      setLoading(true);
      const flujoData = {
        nombre: nombreFlujo,
        operaciones: operaciones.map((op, index) => ({
          ...op,
          orden: index,
        })),
      };

      if (selectedFlujo) {
        await flujosApi.update(selectedFlujo._id, flujoData);
        Alert.alert('Éxito', 'Flujo actualizado');
      } else {
        await flujosApi.create(flujoData);
        Alert.alert('Éxito', 'Flujo creado');
      }
      
      loadFlujos();
    } catch (error) {
      console.error('Error al guardar flujo:', error);
      Alert.alert('Error', 'No se pudo guardar el flujo');
    } finally {
      setLoading(false);
    }
  };

  const agregarOperacion = () => {
    const nuevaOperacion: Operacion = {
      nombre: `Operación ${operaciones.length + 1}`,
      tipo_operacion: 'Sumar',
      tipo_valor: 'Porcentaje',
      orden: operaciones.length,
    };
    setOperaciones([...operaciones, nuevaOperacion]);
  };

  const actualizarOperacion = (index: number, field: keyof Operacion, value: string) => {
    const nuevasOperaciones = [...operaciones];
    nuevasOperaciones[index] = {
      ...nuevasOperaciones[index],
      [field]: value,
    };
    setOperaciones(nuevasOperaciones);
  };

  const eliminarOperacion = (index: number) => {
    setOperaciones(operaciones.filter((_, i) => i !== index));
  };

  const moverOperacion = (index: number, direccion: 'arriba' | 'abajo') => {
    if (
      (direccion === 'arriba' && index === 0) ||
      (direccion === 'abajo' && index === operaciones.length - 1)
    ) {
      return;
    }

    const nuevasOperaciones = [...operaciones];
    const newIndex = direccion === 'arriba' ? index - 1 : index + 1;
    [nuevasOperaciones[index], nuevasOperaciones[newIndex]] = [
      nuevasOperaciones[newIndex],
      nuevasOperaciones[index],
    ];
    setOperaciones(nuevasOperaciones);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Selector de Flujo */}
        <Card style={styles.card}>
          <Card.Content>
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

        {/* Botones de Acción */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={nuevoFlujo}
                style={styles.actionButton}
                icon="plus"
              >
                Nuevo
              </Button>
              <Button
                mode="contained"
                onPress={borrarFlujo}
                style={styles.actionButton}
                buttonColor="#d32f2f"
                icon="delete"
                disabled={!selectedFlujo}
              >
                Borrar
              </Button>
              <Button
                mode="contained"
                onPress={guardarFlujo}
                style={styles.actionButton}
                loading={loading}
                icon="content-save"
              >
                Guardar
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Nombre del Flujo */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Nombre del Flujo</Text>
            <TextInput
              mode="outlined"
              value={nombreFlujo}
              onChangeText={setNombreFlujo}
              placeholder="Ej: Cálculo con IVA"
              style={styles.input}
            />
          </Card.Content>
        </Card>

        {/* Operaciones */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Operaciones</Text>
              <Button
                mode="contained"
                onPress={agregarOperacion}
                icon="plus"
                compact
              >
                Agregar
              </Button>
            </View>

            {operaciones.length === 0 ? (
              <Text style={styles.emptyText}>No hay operaciones aún</Text>
            ) : (
              operaciones.map((operacion, index) => (
                <View key={index} style={styles.operacionCard}>
                  <View style={styles.operacionHeader}>
                    <Text style={styles.operacionNumero}>Operación {index + 1}</Text>
                    <View style={styles.operacionButtons}>
                      <IconButton
                        icon="arrow-up"
                        size={20}
                        onPress={() => moverOperacion(index, 'arriba')}
                        disabled={index === 0}
                      />
                      <IconButton
                        icon="arrow-down"
                        size={20}
                        onPress={() => moverOperacion(index, 'abajo')}
                        disabled={index === operaciones.length - 1}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => eliminarOperacion(index)}
                      />
                    </View>
                  </View>

                  <TextInput
                    mode="outlined"
                    label="Nombre"
                    value={operacion.nombre}
                    onChangeText={(text) => actualizarOperacion(index, 'nombre', text)}
                    style={styles.inputSmall}
                  />

                  <View style={styles.row}>
                    <Menu
                      visible={false}
                      onDismiss={() => {}}
                      anchor={
                        <Button
                          mode="outlined"
                          onPress={() => {
                            const tipos = ['Sumar', 'Restar', 'Multiplicar', 'Dividir'];
                            const currentIndex = tipos.indexOf(operacion.tipo_operacion);
                            const nextIndex = (currentIndex + 1) % tipos.length;
                            actualizarOperacion(index, 'tipo_operacion', tipos[nextIndex]);
                          }}
                          style={styles.halfButton}
                        >
                          {operacion.tipo_operacion}
                        </Button>
                      }
                    />

                    <Button
                      mode="outlined"
                      onPress={() => {
                        const nuevoTipo = operacion.tipo_valor === 'Porcentaje' ? 'Número' : 'Porcentaje';
                        actualizarOperacion(index, 'tipo_valor', nuevoTipo);
                      }}
                      style={styles.halfButton}
                    >
                      {operacion.tipo_valor}
                    </Button>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>
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
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#666',
  },
  input: {
    backgroundColor: '#fff',
  },
  inputSmall: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
  },
  operacionCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  operacionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  operacionNumero: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  operacionButtons: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfButton: {
    flex: 1,
  },
});
