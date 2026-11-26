import type { Lang } from '../types/map';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

export function toBnDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function formatNum(n: number, lang: Lang): string {
  const formatted = n.toLocaleString('en-US');
  return lang === 'bn' ? toBnDigits(formatted) : formatted;
}
