import { format } from "date-fns";

export const formatDateVN = (date: string | Date | null): string => {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "dd/MM/yyyy");
  } catch {
    return "-";
  }
};
