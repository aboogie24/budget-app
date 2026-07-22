import React from 'react';
import { FormChips, type ChipOption } from '@/components/form';

export type BudgetFrequency = 'one-time' | 'weekly' | 'biweekly' | 'monthly' | '1st-15th';

const OPTIONS: ChipOption<BudgetFrequency>[] = [
  { value: 'one-time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: '1st-15th', label: '1st & 15th' },
];

type Props = {
  value: BudgetFrequency;
  onChange: (value: BudgetFrequency) => void;
};

/** Budget frequency chip row — a preset over the shared FormChips kit component. */
export function BudgetAddFrequencyChips({ value, onChange }: Props) {
  return <FormChips options={OPTIONS} value={value} onChange={onChange} />;
}

export default BudgetAddFrequencyChips;
