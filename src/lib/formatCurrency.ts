interface FormatCurrencyOptions {
  showSymbol?: boolean;
}

export const formatCurrency = (value: number | null | undefined, options?: FormatCurrencyOptions): string => {
  if (value == null) return "-";
  const formatted = new Intl.NumberFormat("vi-VN").format(Math.round(value));
  if (options?.showSymbol === false) return formatted;
  return formatted + " đ";
};
