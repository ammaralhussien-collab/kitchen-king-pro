import type { Language } from '@/i18n/translations';

/**
 * Get localized name for an item/category/addon.
 * Falls back to the default `name` field.
 */
export const getLocalizedName = (
  entity: { name: string; name_en?: string | null; name_de?: string | null; name_ar?: string | null },
  lang: Language
): string => {
  if (lang === 'de' && entity.name_de) return entity.name_de;
  if (lang === 'ar' && entity.name_ar) return entity.name_ar;
  if (lang === 'en' && entity.name_en) return entity.name_en;
  return entity.name;
};

/**
 * Get localized description for an item.
 * Falls back to the default `description` field.
 */
export const getLocalizedDesc = (
  entity: { description?: string | null; desc_en?: string | null; desc_de?: string | null; desc_ar?: string | null },
  lang: Language
): string | null => {
  if (lang === 'de' && entity.desc_de) return entity.desc_de;
  if (lang === 'ar' && entity.desc_ar) return entity.desc_ar;
  if (lang === 'en' && entity.desc_en) return entity.desc_en;
  return entity.description ?? null;
};
