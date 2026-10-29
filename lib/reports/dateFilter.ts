/**
 * Date filtering utilities for reports across Customers, Inventory, Invoices, Stock, and Analytics.
 */

export type DateFilterPeriod = 'all' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface DateFilterRange {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

export function getDateRangeBounds(
  period: DateFilterPeriod,
  customStart?: string,
  customEnd?: string
): DateFilterRange {
  const now = new Date();

  switch (period) {
    case 'weekly': {
      // Start of current week (Monday)
      const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = (dayOfWeek + 6) % 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end,
        label: `Weekly (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`,
      };
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthName = start.toLocaleString('default', { month: 'long', year: 'numeric' });
      return {
        startDate: start,
        endDate: end,
        label: `Monthly (${monthName})`,
      };
    }
    case 'yearly': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end,
        label: `Yearly (${now.getFullYear()})`,
      };
    }
    case 'custom': {
      if (customStart && customEnd) {
        const start = new Date(customStart + 'T00:00:00');
        const end = new Date(customEnd + 'T23:59:59.999');
        return {
          startDate: start,
          endDate: end,
          label: `Custom (${start.toLocaleDateString()} to ${end.toLocaleDateString()})`,
        };
      }
      return {
        startDate: null,
        endDate: null,
        label: 'Custom (No Range Selected)',
      };
    }
    case 'all':
    default:
      return {
        startDate: null,
        endDate: null,
        label: 'All Time (Complete Dataset)',
      };
  }
}

export function filterItemsByDate<T>(
  items: T[],
  dateGetter: (item: T) => string | undefined | null,
  period: DateFilterPeriod,
  customStart?: string,
  customEnd?: string
): T[] {
  if (period === 'all') return items;

  const bounds = getDateRangeBounds(period, customStart, customEnd);
  if (!bounds.startDate || !bounds.endDate) return items;

  const startTime = bounds.startDate.getTime();
  const endTime = bounds.endDate.getTime();

  return items.filter((item) => {
    const rawDate = dateGetter(item);
    if (!rawDate) return false;
    const itemDate = new Date(rawDate);
    const itemTime = itemDate.getTime();
    if (isNaN(itemTime)) return false;
    return itemTime >= startTime && itemTime <= endTime;
  });
}
