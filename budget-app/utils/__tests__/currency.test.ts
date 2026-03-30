import {
  formatCurrency,
  getCurrencySymbol,
  getCurrencyName,
  formatCurrencySimple,
  CURRENCIES,
} from '../currency';

describe('Currency Utilities', () => {
  describe('formatCurrency', () => {
    it('should format USD amounts correctly', () => {
      const result = formatCurrency(1234.56, 'USD', 'en-US');
      expect(result).toContain('$');
      expect(result).toContain('1,234.56');
    });

    it('should format EUR amounts correctly', () => {
      const result = formatCurrency(1234.56, 'EUR', 'en-US');
      expect(result).toContain('1,234.56');
    });

    it('should format zero amount correctly', () => {
      const result = formatCurrency(0, 'USD', 'en-US');
      expect(result).toContain('0.00');
    });

    it('should format negative amounts correctly', () => {
      const result = formatCurrency(-500.25, 'USD', 'en-US');
      expect(result).toContain('500.25');
    });

    it('should format very large numbers correctly', () => {
      const result = formatCurrency(1000000.99, 'USD', 'en-US');
      expect(result).toContain('1,000,000.99');
    });

    it('should use default currency USD when not specified', () => {
      const result = formatCurrency(100);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use default locale en-US when not specified', () => {
      const result = formatCurrency(100, 'USD');
      expect(result).toBeDefined();
    });

    it('should handle invalid currency code gracefully', () => {
      const result = formatCurrency(100, 'INVALID');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format small decimal amounts correctly', () => {
      const result = formatCurrency(0.99, 'USD', 'en-US');
      expect(result).toContain('0.99');
    });

    it('should round to 2 decimal places', () => {
      const result = formatCurrency(99.999, 'USD', 'en-US');
      expect(result).toContain('100.00');
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return correct symbol for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('should return correct symbol for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('should return correct symbol for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    it('should return correct symbol for JPY', () => {
      expect(getCurrencySymbol('JPY')).toBe('¥');
    });

    it('should return code itself if currency not found', () => {
      expect(getCurrencySymbol('UNKNOWN')).toBe('UNKNOWN');
    });

    it('should return symbol for all supported currencies', () => {
      CURRENCIES.forEach((currency) => {
        const symbol = getCurrencySymbol(currency.code);
        expect(symbol).toBe(currency.symbol);
      });
    });

    it('should handle case sensitivity', () => {
      expect(getCurrencySymbol('usd')).toBe('usd');
      expect(getCurrencySymbol('USD')).toBe('$');
    });
  });

  describe('getCurrencyName', () => {
    it('should return correct name for USD', () => {
      expect(getCurrencyName('USD')).toBe('US Dollar');
    });

    it('should return correct name for EUR', () => {
      expect(getCurrencyName('EUR')).toBe('Euro');
    });

    it('should return correct name for GBP', () => {
      expect(getCurrencyName('GBP')).toBe('British Pound');
    });

    it('should return code itself if currency not found', () => {
      expect(getCurrencyName('UNKNOWN')).toBe('UNKNOWN');
    });

    it('should return name for all supported currencies', () => {
      CURRENCIES.forEach((currency) => {
        const name = getCurrencyName(currency.code);
        expect(name).toBe(currency.name);
      });
    });
  });

  describe('formatCurrencySimple', () => {
    it('should format USD amounts with symbol prefix', () => {
      const result = formatCurrencySimple(1234.56, 'USD');
      expect(result).toBe('$1234.56');
    });

    it('should format EUR amounts with symbol prefix', () => {
      const result = formatCurrencySimple(999.99, 'EUR');
      expect(result).toBe('€999.99');
    });

    it('should use default currency USD', () => {
      const result = formatCurrencySimple(100);
      expect(result).toContain('$');
    });

    it('should handle zero amount', () => {
      const result = formatCurrencySimple(0, 'USD');
      expect(result).toBe('$0.00');
    });

    it('should always show absolute value for negative amounts', () => {
      const result = formatCurrencySimple(-500.25, 'USD');
      expect(result).toBe('$500.25');
      expect(result).not.toContain('-');
    });

    it('should format to 2 decimal places', () => {
      const result = formatCurrencySimple(100, 'USD');
      expect(result).toBe('$100.00');
    });

    it('should handle very large amounts', () => {
      const result = formatCurrencySimple(1000000.99, 'USD');
      expect(result).toBe('$1000000.99');
    });
  });

  describe('CURRENCIES array', () => {
    it('should contain at least basic currencies', () => {
      const currencyCodes = CURRENCIES.map((c) => c.code);
      expect(currencyCodes).toContain('USD');
      expect(currencyCodes).toContain('EUR');
      expect(currencyCodes).toContain('GBP');
    });

    it('should have unique currency codes', () => {
      const codes = CURRENCIES.map((c) => c.code);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    it('each currency should have code, name, and symbol', () => {
      CURRENCIES.forEach((currency) => {
        expect(currency.code).toBeDefined();
        expect(currency.name).toBeDefined();
        expect(currency.symbol).toBeDefined();
        expect(currency.code.length).toBe(3);
      });
    });
  });
});
