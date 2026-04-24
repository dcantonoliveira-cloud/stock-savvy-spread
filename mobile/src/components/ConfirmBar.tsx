import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  count: number;
  onConfirm: () => void;
  submitting: boolean;
}

export default function ConfirmBar({ count, onConfirm, submitting }: Props) {
  const insets = useSafeAreaInsets();

  if (count === 0) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.bar}>
        <View style={styles.left}>
          <View style={styles.circle}>
            <Text style={styles.heartIcon}>❤️</Text>
          </View>
          <View>
            <Text style={styles.countText}>
              {count} {count === 1 ? 'prato selecionado' : 'pratos selecionados'}
            </Text>
            <Text style={styles.hint}>Toque para confirmar suas preferências</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={onConfirm}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{submitting ? '...' : 'Confirmar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bar: {
    backgroundColor: '#78350f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    fontSize: 16,
  },
  countText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: '#fcd34d',
    fontSize: 11,
    marginTop: 1,
  },
  btn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#78350f',
    fontWeight: '700',
    fontSize: 14,
  },
});
