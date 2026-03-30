export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
];

/**
 * Format currency amount using Intl.NumberFormat
 * @param amount The numeric amount to format
 * @param currencyCode The 3-letter currency code (e.g., 'USD', 'EUR')
 * @param locale The locale to use (default: 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD', locale: string = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    // Fallback if currency code is invalid
    return `${getCurrencySymbol(currencyCode)}${amount.toFixed(2)}`;
  }
}

/**
 * Get the currency symbol for a given code
 * @param code The 3-letter currency code
 * @returns The currency symbol, or the code itself if not found
 */
export function getCurrencySymbol(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency ? currency.symbol : code;
}

/**
 * Get currency name for a given code
 * @param code The 3-letter currency code
 * @returns The full currency name
 */
export function getCurrencyName(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency ? currency.name : code;
}

/**
 * Format currency with symbol prefix (e.g., "$1,234.56")
 * @param amount The numeric amount
 * @param currencyCode The currency code
 * @returns Formatted string with symbol
 */
export function formatCurrencySimple(amount: number, currencyCode: string = 'USD'): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${Math.abs(amount).toFixed(2)}`;
}
