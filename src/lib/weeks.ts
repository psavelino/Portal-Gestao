import { startOfWeek, addWeeks, format } from "date-fns";

/** Segunda-feira da semana que contém `date` (ou hoje, se omitido). */
export function mondayOf(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function isoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function shortLabel(date: Date): string {
  return format(date, "dd/MM");
}

/** Gera `count` segundas-feiras a partir de `start` (inclusive). */
export function weekRange(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addWeeks(start, i));
}
