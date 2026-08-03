/**
 * BulletPickerSheet — search-and-select sheet over @aim/bullet-library.
 *
 * Lets the user fill bulletName/weightGrains/diameterInches/bc/dragModel from
 * a manufacturer-published bullet instead of typing them by hand. Manual
 * entry always remains available — this is purely a shortcut. Selecting an
 * entry never blocks on network: the library is a static on-device import.
 *
 * Field-mode glove rule (CLAUDE.md): every row is a Pressable at least 56dp
 * tall.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { searchBullets, type LibraryBullet } from '@aim/bullet-library';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';
const MIN_ROW_HEIGHT = 56;

interface Props {
  visible: boolean;
  theme: Theme;
  onSelect: (bullet: LibraryBullet) => void;
  onCancel: () => void;
}

function formatBc(bullet: LibraryBullet): string {
  if (bullet.preferredModel === 'G7' && bullet.g7Bc !== null) {
    return `G7 ${bullet.g7Bc.toFixed(3)}`;
  }
  if (bullet.g1Bc !== null) {
    return `G1 ${bullet.g1Bc.toFixed(3)}`;
  }
  return '—';
}

export function BulletPickerSheet({ visible, theme, onSelect, onCancel }: Props) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return searchBullets({ query: trimmed }).slice(0, 100);
  }, [query]);

  function handleSelect(bullet: LibraryBullet) {
    onSelect(bullet);
    setQuery('');
  }

  function handleCancel() {
    setQuery('');
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.header}>
            <Pressable onPress={handleCancel} hitSlop={12} style={styles.headerBtn}>
              <Text style={[styles.cancelBtn, { color: theme.dim }]}>CANCEL</Text>
            </Pressable>
            <Text style={[styles.title, { color: theme.primary }]}>CHOOSE BULLET</Text>
            <View style={styles.headerBtn} />
          </View>

          <TextInput
            style={[
              styles.searchInput,
              { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border },
            ]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search manufacturer, line, or grain (e.g. hornady eld match 140)"
            placeholderTextColor={theme.dim}
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
          />

          {query.trim().length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.dim }]}>
                Start typing to search {'>'}600 manufacturer-published bullets.
              </Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.dim }]}>
                No matches. Try a different spelling, or enter this bullet manually below.
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(b) => b.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: theme.border },
                    pressed && { backgroundColor: theme.bg },
                  ]}
                  accessibilityLabel={`Select ${item.manufacturer} ${item.name}`}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: theme.label }]} numberOfLines={1}>
                      {item.manufacturer} — {item.name}
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.dim }]} numberOfLines={1}>
                      {item.weightGrains}gr · Ø{item.diameterInches.toFixed(3)}&quot; · {formatBc(item)}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    height: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  headerBtn: { minWidth: 64, minHeight: MIN_ROW_HEIGHT, justifyContent: 'center' },
  title: { fontFamily: FONT, fontSize: 12, letterSpacing: 2 },
  cancelBtn: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },
  searchInput: {
    fontFamily: FONT,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: MIN_ROW_HEIGHT,
  },
  list: { flex: 1, marginTop: 8 },
  listContent: { paddingHorizontal: 8, paddingBottom: 16 },
  row: {
    minHeight: MIN_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rowText: { gap: 4 },
  rowTitle: { fontFamily: FONT, fontSize: 13 },
  rowSub: { fontFamily: FONT, fontSize: 11, letterSpacing: 0.5 },
  emptyState: { padding: 24, alignItems: 'center' },
  emptyText: { fontFamily: FONT, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
