import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Provider as PaperProvider } from 'react-native-paper';

export default function TabLayout() {
  return (
    <PaperProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#6200ee',
          tabBarInactiveTintColor: '#666',
          tabBarStyle: {
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          headerStyle: {
            backgroundColor: '#6200ee',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Tabs.Screen
          name="calculator"
          options={{
            title: 'Calculadora',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calculator" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="flows"
          options={{
            title: 'Flujos',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="sitemap" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: 'Productos',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="package-variant" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="history" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="import-export"
          options={{
            title: 'Importar',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="swap-horizontal" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="quotes"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </PaperProvider>
  );
}
