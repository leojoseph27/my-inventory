import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

/**
 * Dashboard Stats API
 *
 * All counts are computed at the database level using Supabase's
 * `count: 'exact'` (which sends a HEAD request and reads the
 * Content-Range header). No rows are fetched into memory, so
 * the results are correct regardless of table size.
 *
 * For metrics that require OR logic or relationship checks
 * (missing images, missing dimensions), we use the complement
 * method: count the rows that DO satisfy the condition, then
 * subtract from total.
 */

export async function GET() {
  try {
    const supabase = createAdminClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 1. Total Products ──
    // Uses HEAD + count=exact → no rows transferred, just the count header.
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    const total = totalProducts || 0;

    // ── 2. Added Today ──
    const { count: productsAddedToday } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // ── 3. Missing Images ──
    // Count products that HAVE at least one row in product_images
    // (inner join), then subtract from total.
    // This avoids fetching all rows into memory.
    const { count: productsWithImages } = await supabase
      .from('products')
      .select('id, product_images!inner(id)', { count: 'exact', head: true });

    const productsMissingImages = total - (productsWithImages || 0);

    // ── 4. Missing Barcode ──
    const { count: productsMissingBarcode } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .is('barcode', null);

    // ── 5. Missing Dimensions ──
    // Count products where ALL three dimensions are present,
    // then subtract from total to get products missing ANY dimension.
    const { count: productsWithAllDims } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .not('length', 'is', null)
      .not('width', 'is', null)
      .not('height', 'is', null);

    const productsMissingDimensions = total - (productsWithAllDims || 0);

    return NextResponse.json({
      totalProducts: total,
      productsAddedToday: productsAddedToday || 0,
      productsMissingImages,
      productsMissingBarcode: productsMissingBarcode || 0,
      productsMissingDimensions,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
