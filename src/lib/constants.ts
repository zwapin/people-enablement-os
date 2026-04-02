export const MACRO_CATEGORIES = [
  { key: "sales", label: "Sales" },
  { key: "customer_success", label: "Customer Success" },
  { key: "operations", label: "Operations" },
  { key: "product", label: "Product" },
  { key: "management", label: "Management" },
  { key: "common", label: "Common Knowledge" },
] as const;

export const TASK_SECTIONS = ["Attività Chiave", "Coaching"] as const;
export type TaskSection = (typeof TASK_SECTIONS)[number];

export const TEAMS = ["Sales", "Customer Success", "Operations", "Product", "Management"] as const;

export type MacroCategoryKey = (typeof MACRO_CATEGORIES)[number]["key"];

export function getCollectionCategories(categories: unknown): string[] {
  return Array.isArray(categories) ? categories : [];
}

const DEPARTMENT_TO_CATEGORY: Record<string, string> = {
  Sales: "sales",
  "Customer Success": "customer_success",
  Operations: "operations",
  Product: "product",
  Management: "management",
};

/** Convert profile departments array to category keys for content filtering */
export function departmentsToCategoryKeys(departments: unknown): string[] {
  const depts = Array.isArray(departments) ? departments : [];
  return depts.map((d: string) => DEPARTMENT_TO_CATEGORY[d]).filter(Boolean);
}

/** Get category keys from a single department string (legacy) */
export function departmentToCategoryKey(department: string | null | undefined): string | null {
  if (!department) return null;
  return DEPARTMENT_TO_CATEGORY[department] ?? null;
}

/** Get departments array from profile, with fallback to single department */
export function getProfileDepartments(profile: { departments?: unknown; department?: string | null }): string[] {
  if (Array.isArray(profile.departments) && profile.departments.length > 0) return profile.departments;
  if (profile.department) return [profile.department];
  return [];
}
