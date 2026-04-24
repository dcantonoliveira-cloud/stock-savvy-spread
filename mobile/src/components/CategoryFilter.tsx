import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
}

export default function CategoryFilter({ categories, active, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {['all', ...categories].map((cat) => (
        <TouchableOpacity
          key={cat}
          style={[styles.tab, active === cat && styles.tabActive]}
          onPress={() => onSelect(cat)}
          activeOpacity={0.75}
        >
          <Text style={[styles.label, active === cat && styles.labelActive]}>
            {cat === 'all' ? 'Todos' : cat}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f5f5f4',
  },
  tabActive: {
    backgroundColor: '#92400e',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#78716c',
  },
  labelActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
