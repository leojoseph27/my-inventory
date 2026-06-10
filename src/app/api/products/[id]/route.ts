import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { mapProductFromDb, mapProductToDb } from '@/utils/supabase/mappers';

/**
 * Normalizes array-like fields for JSONB columns in Supabase.
 *
 * IMPORTANT: Supabase JSONB columns require actual JavaScript arrays/objects,
 * NOT JSON strings. Passing '["Red","Blue"]' (a string) to a JSONB column
 * causes PostgreSQL to store it as a text string inside JSONB, which breaks
 * queries and exports. We must pass ["Red","Blue"] (actual array).
 *
 * Handles:
 * - Array (from frontend form) → pass through as-is
 * - String that looks like JSON → parse to array
 * - Comma-separated string → parse to array
 * - null/undefined/empty → null
 */
function normalizeJsonField(value: any): any[] | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    return value.length > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Already a JSON array string? Parse it to an actual array
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : null;
      } catch {}
    }
    // Comma/semicolon separated values → parse to array
    const items = trimmed.split(/[,;|]/).map(v => v.trim()).filter(Boolean);
    return items.length > 0 ? items : null;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('products')
      .select('*, product_images(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(mapProductFromDb(data));
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const body = await request.json();

    // Build update data — only include fields that are explicitly provided in the request body.
    // This prevents nulling out fields that the client didn't intend to change.
    const updateData: Record<string, any> = {};

    // Mapping of request body keys to their database column names and normalizers
    const fieldMappings: Record<string, { dbKey: string; normalize?: (v: any) => any }> = {
      sr: { dbKey: 'sr' },
      englishDescription: { dbKey: 'english_description' },
      arabicDescription: { dbKey: 'arabic_description' },
      ndNumber: { dbKey: 'nd_number' },
      barcode: { dbKey: 'barcode' },
      colours: { dbKey: 'colours', normalize: normalizeJsonField },
      length: { dbKey: 'length' },
      width: { dbKey: 'width' },
      height: { dbKey: 'height' },
      made: { dbKey: 'made' },
      materials: { dbKey: 'materials', normalize: normalizeJsonField },
      additionalInfo: { dbKey: 'additional_info', normalize: normalizeJsonField },
      price: { dbKey: 'price' },
      pcs: { dbKey: 'pcs' },
    };

    for (const [bodyKey, mapping] of Object.entries(fieldMappings)) {
      if (bodyKey in body) {
        const rawValue = body[bodyKey];
        const value = mapping.normalize ? mapping.normalize(rawValue) : (rawValue ?? null);
        updateData[mapping.dbKey] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select('*, product_images(*)')
      .single();

    if (error) {
      console.error('Supabase error updating product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapProductFromDb(data));
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // First get the product to find its images for storage cleanup
    const { data: product } = await supabase
      .from('products')
      .select('*, product_images(*)')
      .eq('id', id)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Delete images from Supabase Storage
    if (product.product_images && product.product_images.length > 0) {
      const filePaths = product.product_images.map((img: any) => {
        try {
          const url = new URL(img.image_url);
          const pathParts = url.pathname.split('/');
          return pathParts.slice(pathParts.indexOf('product-images') + 1).join('/');
        } catch {
          return null;
        }
      }).filter(Boolean);

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('product-images')
          .remove(filePaths);

        if (storageError) {
          console.error('Error deleting images from storage:', storageError);
        }
      }
    }

    // Delete product (cascades to product_images via FK)
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error deleting product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
