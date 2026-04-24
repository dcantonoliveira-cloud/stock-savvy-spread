import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const [eventId, setEventId] = useState('');

  const canSubmit = eventId.trim().length > 0;

  const handleEnter = () => {
    if (!canSubmit) return;
    navigation.navigate('Evento', { eventId: eventId.trim() });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Monogram */}
          <View style={styles.monogram}>
            <Text style={styles.monogramLetter}>R</Text>
          </View>

          {/* Brand */}
          <Text style={styles.brand}>RONDELLO</Text>
          <Text style={styles.brandSub}>BUFFET & GASTRONOMIA</Text>

          {/* Divider */}
          <View style={styles.divider} />

          <Text style={styles.description}>
            Informe o código do seu evento para visualizar e selecionar os pratos do cardápio
          </Text>

          {/* Input */}
          <TextInput
            style={styles.input}
            placeholder="Código do evento"
            placeholderTextColor="#a8a29e"
            value={eventId}
            onChangeText={setEventId}
            onSubmitEditing={handleEnter}
            returnKeyType="go"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />

          {/* CTA */}
          <TouchableOpacity
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleEnter}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Acessar Cardápio</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            O código é fornecido pela equipe Rondello no momento da contratação
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#faf8f5',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: 'center',
  },
  monogram: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#92400e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#92400e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  monogramLetter: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 8,
    color: '#292524',
  },
  brandSub: {
    fontSize: 11,
    letterSpacing: 4,
    color: '#a8a29e',
    marginTop: 4,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: '#e7e5e4',
    borderRadius: 1,
    marginVertical: 28,
  },
  description: {
    textAlign: 'center',
    color: '#78716c',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#292524',
    marginBottom: 14,
  },
  btn: {
    width: '100%',
    backgroundColor: '#92400e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#92400e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hint: {
    marginTop: 16,
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 18,
  },
});
