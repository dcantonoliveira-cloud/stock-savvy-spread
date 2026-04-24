import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { BubblePrato } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Entrada: { bg: '#d1fae5', text: '#065f46' },
  'Prato Principal': { bg: '#fef3c7', text: '#92400e' },
  Acompanhamento: { bg: '#dbeafe', text: '#1e40af' },
  Sobremesa: { bg: '#fce7f3', text: '#9d174d' },
  Bebida: { bg: '#ede9fe', text: '#5b21b6' },
};

function categoryColors(cat: string | undefined) {
  return CATEGORY_COLORS[cat ?? ''] ?? { bg: '#f5f5f4', text: '#57534e' };
}

function parseIngredients(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Props {
  prato: BubblePrato;
  favorited: boolean;
  onToggle: (id: string) => void;
}

export default function DishCard({ prato, favorited, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colors = categoryColors(prato.Categoria);
  const initial = prato.Nome?.trim()[0]?.toUpperCase() ?? '?';
  const ingredients = parseIngredients(prato.Ingredientes);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={[styles.card, favorited && styles.cardFavorited]}>
      {/* Image */}
      <View>
        {prato.Imagem ? (
          <Image
            source={{ uri: prato.Imagem }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>{initial}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.heartBtn, favorited && styles.heartBtnActive]}
          onPress={() => onToggle(prato._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.heartIcon}>{favorited ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {prato.Nome}
        </Text>

        {prato.Categoria ? (
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {prato.Categoria}
            </Text>
          </View>
        ) : null}

        {prato.Descricao ? (
          <Text style={styles.description} numberOfLines={2}>
            {prato.Descricao}
          </Text>
        ) : null}

        {ingredients.length > 0 && (
          <>
            <TouchableOpacity onPress={toggleExpanded} style={styles.toggleBtn}>
              <Text style={styles.toggleText}>
                {expanded
                  ? '▲ Ocultar ingredientes'
                  : `▼ Ver ${ingredients.length} ingrediente${ingredients.length === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>

            {expanded && (
              <View style={styles.chipsRow}>
                {ingredients.map((ing, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{ing}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardFavorited: {
    borderColor: '#fda4af',
    shadowColor: '#f43f5e',
    shadowOpacity: 0.18,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: 160,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 52,
    fontWeight: '700',
    color: '#d6d3d1',
  },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnActive: {
    backgroundColor: '#f43f5e',
  },
  heartIcon: {
    fontSize: 17,
  },
  body: {
    padding: 14,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#292524',
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    color: '#78716c',
    lineHeight: 18,
    marginBottom: 6,
  },
  toggleBtn: {
    marginTop: 4,
    paddingVertical: 2,
  },
  toggleText: {
    fontSize: 12,
    color: '#a8a29e',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  chip: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    color: '#78716c',
  },
});
