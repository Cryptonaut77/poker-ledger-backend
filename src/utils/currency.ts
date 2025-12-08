// Currency formatting utilities

interface CurrencyInfo {
  code: string;
  symbol: string;
  decimals: number;
  symbolPosition: "before" | "after";
}

const CURRENCY_INFO: Record<string, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", decimals: 2, symbolPosition: "before" },
  EUR: { code: "EUR", symbol: "€", decimals: 2, symbolPosition: "before" },
  GBP: { code: "GBP", symbol: "£", decimals: 2, symbolPosition: "before" },
  JPY: { code: "JPY", symbol: "¥", decimals: 0, symbolPosition: "before" },
  CNY: { code: "CNY", symbol: "¥", decimals: 2, symbolPosition: "before" },
  AUD: { code: "AUD", symbol: "A$", decimals: 2, symbolPosition: "before" },
  CAD: { code: "CAD", symbol: "C$", decimals: 2, symbolPosition: "before" },
  CHF: { code: "CHF", symbol: "CHF ", decimals: 2, symbolPosition: "before" },
  INR: { code: "INR", symbol: "₹", decimals: 2, symbolPosition: "before" },
  MXN: { code: "MXN", symbol: "MX$", decimals: 2, symbolPosition: "before" },
  BRL: { code: "BRL", symbol: "R$", decimals: 2, symbolPosition: "before" },
  ZAR: { code: "ZAR", symbol: "R", decimals: 2, symbolPosition: "before" },
  SGD: { code: "SGD", symbol: "S$", decimals: 2, symbolPosition: "before" },
  HKD: { code: "HKD", symbol: "HK$", decimals: 2, symbolPosition: "before" },
  SEK: { code: "SEK", symbol: " kr", decimals: 2, symbolPosition: "after" },
  NOK: { code: "NOK", symbol: " kr", decimals: 2, symbolPosition: "after" },
  DKK: { code: "DKK", symbol: " kr", decimals: 2, symbolPosition: "after" },
  NZD: { code: "NZD", symbol: "NZ$", decimals: 2, symbolPosition: "before" },
  KRW: { code: "KRW", symbol: "₩", decimals: 0, symbolPosition: "before" },
  THB: { code: "THB", symbol: "฿", decimals: 2, symbolPosition: "before" },
  AED: { code: "AED", symbol: "AED ", decimals: 2, symbolPosition: "before" },
  SAR: { code: "SAR", symbol: "SAR ", decimals: 2, symbolPosition: "before" },
  PLN: { code: "PLN", symbol: " zł", decimals: 2, symbolPosition: "after" },
  TRY: { code: "TRY", symbol: "₺", decimals: 2, symbolPosition: "before" },
};

/**
 * Format a number as currency based on the currency code
 * @param amount The amount to format
 * @param currencyCode The currency code (e.g., "USD", "EUR")
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currencyCode: string = "USD"): string => {
  const info = CURRENCY_INFO[currencyCode] || CURRENCY_INFO.USD;

  const formattedAmount = amount.toFixed(info.decimals);

  if (info.symbolPosition === "before") {
    return `${info.symbol}${formattedAmount}`;
  } else {
    return `${formattedAmount}${info.symbol}`;
  }
};

/**
 * Get currency symbol for a currency code
 * @param currencyCode The currency code (e.g., "USD", "EUR")
 * @returns Currency symbol
 */
export const getCurrencySymbol = (currencyCode: string = "USD"): string => {
  const info = CURRENCY_INFO[currencyCode] || CURRENCY_INFO.USD;
  return info.symbol.trim();
};
