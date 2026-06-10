/**
 * Converts a camelCase string to snake_case.
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converts a snake_case string to camelCase.
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts an object with camelCase keys to snake_case keys.
 * Used when sending data TO Supabase.
 */
export function toSnakeCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

/**
 * Converts an object with snake_case keys to camelCase keys.
 * Used when receiving data FROM Supabase.
 */
export function toCamelCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

/**
 * Converts a Supabase product row (snake_case) to the camelCase format
 * expected by the frontend.
 *
 * IMPORTANT: JSONB columns (colours, materials, additional_info) are stored
 * as proper JSONB arrays in PostgreSQL. When read back, Supabase returns them
 * as JavaScript arrays (e.g., ["Steel","Plastic"]). The frontend expects
 * JSON strings (e.g., '["Steel","Plastic"]'). This mapper serializes them
 * back to strings so the frontend's JSON.parse() calls continue to work.
 */
export function mapProductFromDb(row: any): any {
  if (!row) return null;

  // Serialize JSONB arrays back to JSON strings for frontend compatibility.
  // The frontend uses JSON.parse() on these fields, so they must be strings.
  // If the value is null or a string (backward compat with old data), pass through.
  const serializeJsonb = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'string') return value; // backward compat with string-stored data
    return JSON.stringify(value);
  };

  const product = {
    id: row.id,
    sr: row.sr,
    englishDescription: row.english_description,
    arabicDescription: row.arabic_description,
    ndNumber: row.nd_number,
    barcode: row.barcode,
    colours: serializeJsonb(row.colours),
    length: row.length,
    width: row.width,
    height: row.height,
    made: row.made,
    materials: serializeJsonb(row.materials),
    additionalInfo: serializeJsonb(row.additional_info),
    price: row.price,
    pcs: row.pcs,
    photo: row.photo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: [] as any[],
  };

  // Map nested product_images if present
  if (row.product_images && Array.isArray(row.product_images)) {
    product.images = row.product_images.map(mapImageFromDb);
  }

  return product;
}

/**
 * Converts a Supabase product_images row (snake_case) to camelCase.
 */
export function mapImageFromDb(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    imageUrl: row.image_url,
    displayOrder: row.display_order,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

/**
 * Converts a camelCase product data object to snake_case for Supabase insert/update.
 */
export function mapProductToDb(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  const fieldMap: Record<string, string> = {
    englishDescription: 'english_description',
    arabicDescription: 'arabic_description',
    ndNumber: 'nd_number',
    additionalInfo: 'additional_info',
  };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const dbKey = fieldMap[key] || camelToSnake(key);
    result[dbKey] = value;
  }

  return result;
}
