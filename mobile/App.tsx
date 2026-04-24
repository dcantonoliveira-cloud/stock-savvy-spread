import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RootStackParamList } from './src/types';
import HomeScreen from './src/screens/HomeScreen';
import EventoScreen from './src/screens/EventoScreen';
import SuccessScreen from './src/screens/SuccessScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#faf8f5' },
            headerTintColor: '#92400e',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#faf8f5' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Evento"
            component={EventoScreen}
            options={{
              title: 'Cardápio',
              headerBackTitle: 'Voltar',
            }}
          />
          <Stack.Screen
            name="Success"
            component={SuccessScreen}
            options={{
              title: 'Confirmado',
              headerBackVisible: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
