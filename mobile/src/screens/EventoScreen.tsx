import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { fetchEvento, fetchPratos, submitMenuSelecao } from '../api/bubble';
import CategoryFilter from '../components/CategoryFilter';
import ConfirmBar from '../components/ConfirmBar';
import DishCard from '../components/DishCard';
import { BubbleEvento, BubblePrato, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Evento'>;
  route: RouteProp<RootStackParamList, 'Evento'>;
};

export default function EventoScreen({ navigation, route }: Props) {
  const { eventId } = route.params;

  const [evento, setEvento] = useState<BubbleEvento | null>(null);
  const [pratos, setPratos] = useState<BubblePrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [eventoResult, pratosResult] = await Promise.allSettled([
        fetchEvento(eventId),
        fetchPratos(),
      ]);

      if (eventoResult.status === 'fulfilled') setEvento(eventoResult.value);
      if (pratosResult.status === 'fulfilled') {
        setPratos(pratosResult.value);
      } else {
        setError('Não foi possível carregar os pratos. Tente novamente.');
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    try {
      await submitMenuSelecao(eventId, [...favorites]);
    } catch {
      // Network error — proceed to success anyway (selection already registered locally)
    }

    const selected = pratos.filter((p) => favorites.has(p._id));
    navigation.replace('Success', { selectedDishes: selected });
    setSubmitting(false);
  };

  const categories = [
    ...new Set(pratos.map((p) => p.Categoria).filter(Boolean) as string[]),
  ];

  const filtered =
    activeCategory === 'all'
      ? pratos
      : pratos.filter((p) => p.Categoria === activeCategory);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#92400e" />
        <Text style={styles.loadingText}>Carregando cardápio…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  const ListHeader = (
    <>
      {/* Event badge */}
      <View style={styles.header}>
        <Text style={styles.brand}>RONDELLO</Text>
        <Text style={styles.brandSub}>BUFFET & GASTRONOMIA</Text>

        {(evento?.NomeDoContratante || evento?.NomeDoEvento) && (
          <View style={styles.eventBadge}>
            {evento.NomeDoContratante ? (
              <Text style={styles.contractorName}>{evento.NomeDoContratante}</Text>
            ) : null}
            {evento.NomeDoEvento ? (
              <Text style={styles.eventName}>{evento.NomeDoEvento}</Text>
            ) : null}
          </View>
        )}

        <Text style={styles.subtitle}>
          Selecione os pratos que gostaria no cardápio do seu evento
        </Text>
      </View>

      {/* Category filter */}
      {categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          active={activeCategory}
          onSelect={setActiveCategory}
        />
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <DishCard
            prato={item}
            favorited={favorites.has(item._id)}
            onToggle={toggleFavorite}
          />
        )}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor="#92400e"
            colors={['#92400e']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyText}>Nenhum prato disponível no momento</Text>
          </View>
        }
      />

      <ConfirmBar
        count={favorites.size}
        onConfirm={handleConfirm}
        submitting={submitting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#faf8f5',
  },
  center: {
    flex: 1,
    backgroundColor: '#faf8f5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: {
    color: '#78716c',
    fontSize: 15,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 4,
  },
  errorText: {
    color: '#78716c',
    fontSize: 15,
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    alignItems: 'center',
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#292524',
  },
  brandSub: {
    fontSize: 10,
    letterSpacing: 3,
    color: '#a8a29e',
    marginTop: 2,
  },
  eventBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  contractorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350f',
  },
  eventName: {
    fontSize: 12,
    color: '#92400e',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#78716c',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#78716c',
  },
});
