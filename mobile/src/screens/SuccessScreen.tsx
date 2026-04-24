import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Success'>;
  route: RouteProp<RootStackParamList, 'Success'>;
};

export default function SuccessScreen({ navigation, route }: Props) {
  const { selectedDishes } = route.params;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Check icon */}
        <Text style={styles.checkIcon}>✅</Text>

        <Text style={styles.title}>Preferências enviadas!</Text>
        <Text style={styles.subtitle}>
          Obrigado! Suas escolhas foram registradas com sucesso.
        </Text>

        {/* Selected dishes card */}
        {selectedDishes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PRATOS SELECIONADOS</Text>

            {selectedDishes.map((dish) => (
              <View key={dish._id} style={styles.dishRow}>
                {dish.Imagem ? (
                  <Image
                    source={{ uri: dish.Imagem }}
                    style={styles.dishImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.dishImgPlaceholder}>
                    <Text style={styles.dishInitial}>
                      {dish.Nome?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.dishInfo}>
                  <Text style={styles.dishName}>{dish.Nome}</Text>
                  {dish.Categoria ? (
                    <Text style={styles.dishCategory}>{dish.Categoria}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.note}>
          Nossa equipe entrará em contato para confirmar o cardápio do seu evento.
        </Text>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>Voltar ao início</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#faf8f5',
  },
  content: {
    padding: 28,
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 72,
    marginTop: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#292524',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 18,
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a8a29e',
    letterSpacing: 2,
    marginBottom: 14,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dishImg: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  dishImgPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#d6d3d1',
  },
  dishInfo: {
    flex: 1,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#292524',
  },
  dishCategory: {
    fontSize: 12,
    color: '#78716c',
    marginTop: 2,
  },
  note: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  backBtn: {
    borderWidth: 1.5,
    borderColor: '#92400e',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  backBtnText: {
    color: '#92400e',
    fontWeight: '600',
    fontSize: 15,
  },
});
