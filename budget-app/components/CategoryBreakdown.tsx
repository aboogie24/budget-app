import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type SubcategorySummary = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  spent: number;
  transaction_count: number;
  has_unverified: boolean;
  unverified_count: number;
};

export type CategorySummary = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  spent: number;
  transaction_count: number;
  has_unverified: boolean;
  unverified_count: number;
  subcategories: SubcategorySummary[];
};

type Props = {
  categories: CategorySummary[];
  onCategoryPress?: (categoryId: string) => void;
};

const fmt = (n: number) =>
  '$' +
  Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function CategoryBreakdown({ categories, onCategoryPress }: Props) {
  if (!categories || categories.length === 0) {
    return (
      <Text style={styles.emptyText}>No category breakdown available</Text>
    );
  }

  return (
    <View>
      {categories.map((cat, catIndex) => {
        const isLast = catIndex === categories.length - 1;
        const dotColor = cat.color || '#a855f7';

        return (
          <View key={cat.id || catIndex}>
            {/* Parent category row */}
            <TouchableOpacity
              style={styles.parentRow}
              activeOpacity={onCategoryPress ? 0.7 : 1}
              onPress={() => onCategoryPress?.(cat.id)}
            >
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              <Text style={styles.parentName} numberOfLines={1}>
                {cat.name}
              </Text>
              {cat.has_unverified && cat.unverified_count > 0 && (
                <View style={styles.warningBadge}>
                  <Ionicons name="alert-circle" size={12} color="#fbbf24" />
                  <Text style={styles.warningText}>{cat.unverified_count}</Text>
                </View>
              )}
              <Text style={styles.parentAmount}>{fmt(cat.spent)}</Text>
            </TouchableOpacity>

            {/* Subcategory rows */}
            {(cat.subcategories ?? []).map((sub, subIndex) => {
              const isLastSub = subIndex === (cat.subcategories ?? []).length - 1;
              const treeChar = isLastSub ? '\u2514\u2500' : '\u251C\u2500';
              const subColor = sub.color || dotColor;

              return (
                <TouchableOpacity
                  key={sub.id || subIndex}
                  style={styles.subRow}
                  activeOpacity={onCategoryPress ? 0.7 : 1}
                  onPress={() => onCategoryPress?.(sub.id)}
                >
                  <Text style={styles.treeLine}>{treeChar}</Text>
                  <View style={[styles.subDot, { backgroundColor: subColor }]} />
                  <Text style={styles.subName} numberOfLines={1}>
                    {sub.name}
                  </Text>
                  {sub.has_unverified && sub.unverified_count > 0 && (
                    <View style={styles.subWarningBadge}>
                      <Ionicons name="alert-circle" size={10} color="#fbbf24" />
                    </View>
                  )}
                  <Text style={styles.subAmount}>{fmt(sub.spent)}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Divider between parent groups */}
            {!isLast && <View style={styles.divider} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  parentName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 4,
  },
  warningText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fbbf24',
  },
  parentAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 16,
  },
  treeLine: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.15)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 20,
  },
  subDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    flex: 1,
  },
  subWarningBadge: {
    marginRight: 4,
  },
  subAmount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginVertical: 4,
  },
});
