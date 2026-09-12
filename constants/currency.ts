export const CURRENCIES = {
  NGN: { symbol: "₦", name: "Nigerian Naira" },
  GHS: { symbol: "₵", name: "Ghanaian Cedi" },
  KES: { symbol: "KSh", name: "Kenyan Shilling" },
  ZAR: { symbol: "R", name: "South African Rand" },
  EGP: { symbol: "E£", name: "Egyptian Pound" },
  UGX: { symbol: "USh", name: "Ugandan Shilling" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_CURRENCY: CurrencyCode = "NGN";

export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY,
) {
  const currency = CURRENCIES[currencyCode] ?? CURRENCIES[DEFAULT_CURRENCY];
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 2,
  }).format(value);

  return `${currency.symbol}${formatted}`;
}
