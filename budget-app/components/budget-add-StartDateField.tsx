import React from 'react';
import { FormDateField } from '@/components/form';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  open: boolean;
  onToggle: () => void;
};

/** Start-date field — a preset over the shared FormDateField kit component. */
export function BudgetAddStartDateField({ value, onChange, open, onToggle }: Props) {
  return (
    <FormDateField
      value={value}
      onChange={onChange}
      open={open}
      onToggle={onToggle}
      accessibilityLabel="Start date"
    />
  );
}

export default BudgetAddStartDateField;
