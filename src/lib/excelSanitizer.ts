/**
 * Excel Cell Sanitizer
 * 
 * Prevents formula injection attacks in Excel files.
 * When cells start with formula characters (=, +, -, @, |, \),
 * they could execute as formulas when the file is opened in Excel.
 * 
 * This sanitizer prefixes such values with a single quote (')
 * to force text interpretation.
 */

const FORMULA_INJECTION_PATTERN = /^[=+\-@|\\]/;

/**
 * Sanitizes a cell value to prevent Excel formula injection.
 * 
 * @param value - The value to sanitize
 * @returns Sanitized value safe for Excel export
 */
export function sanitizeExcelCell(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Prefix with single quote to force text interpretation in Excel
    if (FORMULA_INJECTION_PATTERN.test(trimmed)) {
      return "'" + trimmed;
    }
  }
  return value;
}

/**
 * Sanitizes an object's string values for Excel export.
 * 
 * @param obj - The object to sanitize
 * @returns Object with sanitized string values
 */
export function sanitizeExcelRow(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeExcelCell(value);
  }
  return sanitized;
}

/**
 * Sanitizes a string value from Excel import.
 * Removes or escapes potential formula injection characters.
 * 
 * @param value - The imported value to sanitize
 * @returns Sanitized string safe for database storage
 */
export function sanitizeExcelImport(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value).trim();
  
  // If it starts with formula characters, prefix with single quote
  // This ensures it's stored as text and won't be interpreted as formula
  if (FORMULA_INJECTION_PATTERN.test(stringValue)) {
    // For import, we remove the formula prefix character(s) 
    // to prevent re-injection on export
    return stringValue.replace(FORMULA_INJECTION_PATTERN, '');
  }
  
  return stringValue;
}
