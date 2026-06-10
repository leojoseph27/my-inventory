import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { mapProductFromDb, mapProductToDb } from '@/utils/supabase/mappers';

/**
 * Ensures array-like fields are stored as JSON strings in Supabase.
 * Handles both arrays (from frontend form) and strings (from API/Excel).
 * - Array → JSON.stringify
 * - String that looks like JSON → pass through
 * - String with comma-separated values → parse and stringify
 * - null/undefined/empty → null
 */
function normalizeJsonField(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    return value.length > 0 ? JSON.stringify(value) : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Already a JSON array string? Pass through
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return trimmed;
      } catch {}
    }
    // Comma/semicolon separated values
    const items = trimmed.split(/[,;|]/).map(v => v.trim()).filter(Boolean);
    return items.length > 0 ? JSON.stringify(items) : null;
  }
  return null;
}

/**
 * Valid sort columns mapped to Supabase column names.
 */
const SORT_COLUMNS: Record<string, string> = {
  'nd_number': 'nd_number',
  'english_description': 'english_description',
  'recently_updated': 'updated_at',
  'recently_added': 'created_at',
  'sr': 'sr',
  'price': 'price',
};

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || '';

    // ── ND Groups mode ──
    // Returns aggregated list of nd_number values with product counts.
    if (mode === 'nd-groups') {
      const search = searchParams.get('search') || '';
      let query = supabase
        .from('products')
        .select('nd_number')
        .not('nd_number', 'is', null);

      if (search) {
        query = query.ilike('nd_number', `%${search}%`);
      }

      // Fetch all nd_number values (paginated to handle >1000 rows)
      const allRows: { nd_number: string }[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query.range(offset, offset + batchSize - 1);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allRows.push(...data);
          hasMore = data.length === batchSize;
          offset += batchSize;
        }
      }

      // Aggregate counts
      const groupMap = new Map<string, number>();
      for (const row of allRows) {
        const nd = row.nd_number;
        if (nd) {
          groupMap.set(nd, (groupMap.get(nd) || 0) + 1);
        }
      }

      const groups = Array.from(groupMap.entries())
        .map(([ndNumber, count]) => ({ ndNumber, count }))
        .sort((a, b) => b.count - a.count || a.ndNumber.localeCompare(b.ndNumber));

      return NextResponse.json({ groups, totalGroups: groups.length });
    }

    // ── Normal product listing mode ──
    const search = searchParams.get('search') || '';
    const material = searchParams.get('material') || '';
    const colour = searchParams.get('colour') || '';
    const made = searchParams.get('made') || '';
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'sr';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const ndNumber = searchParams.get('ndNumber') || '';

    // Resolve sort column
    const sortColumn = SORT_COLUMNS[sortBy] || 'sr';
    const sortAscending = sortOrder === 'asc';

    // Build the query
    let query = supabase
      .from('products')
      .select('*, product_images(*)', { count: 'exact' })
      .order(sortColumn, { ascending: sortAscending, nullsFirst: true })
      .range((page - 1) * limit, page * limit - 1);

    // Search filter (OR across multiple fields)
    if (search) {
      query = query.or(
        `nd_number.ilike.%${search}%,barcode.ilike.%${search}%,english_description.ilike.%${search}%,arabic_description.ilike.%${search}%,materials.ilike.%${search}%,colours.ilike.%${search}%`
      );
    }

    // Filter by specific ND Number (for grouping)
    if (ndNumber) {
      query = query.eq('nd_number', ndNumber);
    }

    if (material) {
      query = query.ilike('materials', `%${material}%`);
    }

    if (colour) {
      query = query.ilike('colours', `%${colour}%`);
    }

    if (made) {
      query = query.ilike('made', `%${made}%`);
    }

    if (priceMin) {
      query = query.gte('price', parseFloat(priceMin));
    }

    if (priceMax) {
      query = query.lte('price', parseFloat(priceMax));
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Supabase error fetching products:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const products = (data || []).map(mapProductFromDb);

    return NextResponse.json({ products, total: count || 0, page, limit });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const dbData = mapProductToDb({
      sr: body.sr ?? null,
      englishDescription: body.englishDescription || null,
      arabicDescription: body.arabicDescription || null,
      ndNumber: body.ndNumber || null,
      barcode: body.barcode || null,
      colours: normalizeJsonField(body.colours),
      length: body.length ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
      made: body.made || null,
      materials: normalizeJsonField(body.materials),
      additionalInfo: normalizeJsonField(body.additionalInfo),
      price: body.price ?? null,
      pcs: body.pcs ?? null,
    });

    const { data, error } = await supabase
      .from('products')
      .insert(dbData)
      .select('*, product_images(*)')
      .single();

    if (error) {
      console.error('Supabase error creating product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapProductFromDb(data), { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
