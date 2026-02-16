interface CurrencyDisplayProps {
  value: number | null | undefined;
  size?: "sm" | "md" | "lg";
  hideValue?: boolean;
  variant?: "default" | "income" | "expense";
}

export const CurrencyDisplay = ({ value, size = "md", hideValue = false, variant = "default" }: CurrencyDisplayProps) => {
  if (hideValue) return <span className="text-muted-foreground">***</span>;
  if (value == null) return <span>-</span>;

  const formatted = new Intl.NumberFormat("vi-VN").format(Math.round(value));

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg font-semibold",
  };

  const variantClasses = {
    default: "",
    income: "text-green-600 dark:text-green-400",
    expense: "text-red-600 dark:text-red-400",
  };

  return <span className={`${sizeClasses[size]} ${variantClasses[variant]}`}>{formatted} đ</span>;
};
