import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type BudgetIconProps = {
  type: 'income' | 'expense';
  category?: string;
};

const categoryIconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  salary: 'attach-money',
  freelance: 'work',
  rent: 'home',
  groceries: 'shopping-cart',
  utilities: 'lightbulb-outline',
  other: 'pie-chart',
};

export const getIconName = (categoryName = ''): keyof typeof MaterialIcons.glyphMap => {
  const key = categoryName.toLowerCase();
  return categoryIconMap[key] || categoryIconMap.other;
};

export const getColorByType = (type: string): string => {
  switch (type) {
    case 'income':
      return '#4CAF50';
    case 'expense':
      return '#d32f2f';
    default:
      return '#9e9e9e';
  }
};

export const BudgetIcon: React.FC<BudgetIconProps> = ({ type, category }) => {
  const iconName = getIconName(category);
  const backgroundColor = getColorByType(type);

  return (
    <View style={{
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      backgroundColor,
    }}>
      <MaterialIcons name={iconName} size={22} color="white" />
    </View>
  );
};
