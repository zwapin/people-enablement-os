export const MACRO_CATEGORIES = [
  { key: "sales", label: "Sales" },
  { key: "customer_success", label: "Customer Success" },
  { key: "operations", label: "Operations" },
  { key: "common", label: "Common Knowledge" },
] as const;

export type MacroCategoryKey = (typeof MACRO_CATEGORIES)[number]["key"];

export function getCollectionCategories(categories: unknown): string[] {
  return Array.isArray(categories) ? categories : [];
}
