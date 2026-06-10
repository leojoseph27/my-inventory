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

    // ── Suggestions mode ──
    // Returns distinct colour, material, and made-in values from all products.
    if (mode === 'suggestions') {
      const allColours: string[] = [];
      const allMaterials: string[] = [];
      const allMade: string[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('colours, materials, made')
          .order('sr', { ascending: true, nullsFirst: true })
          .range(offset, offset + batchSize - 1);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          for (const row of data) {
            // Flatten colours
            if (row.colours) {
              if (Array.isArray(row.colours)) {
                allColours.push(...row.colours.filter(Boolean));
              } else if (typeof row.colours === 'string') {
                try {
                  const parsed = JSON.parse(row.colours);
                  if (Array.isArray(parsed)) allColours.push(...parsed.filter(Boolean));
                } catch {
                  row.colours.split(/[,;|]/).forEach((v: string) => {
                    const trimmed = v.trim();
                    if (trimmed) allColours.push(trimmed);
                  });
                }
              }
            }
            // Flatten materials
            if (row.materials) {
              if (Array.isArray(row.materials)) {
                allMaterials.push(...row.materials.filter(Boolean));
              } else if (typeof row.materials === 'string') {
                try {
                  const parsed = JSON.parse(row.materials);
                  if (Array.isArray(parsed)) allMaterials.push(...parsed.filter(Boolean));
                } catch {
                  row.materials.split(/[,;|]/).forEach((v: string) => {
                    const trimmed = v.trim();
                    if (trimmed) allMaterials.push(trimmed);
                  });
                }
              }
            }
            // Collect made-in values
            if (row.made && typeof row.made === 'string') {
              const trimmed = row.made.trim();
              if (trimmed) allMade.push(trimmed);
            }
          }
          hasMore = data.length === batchSize;
          offset += batchSize;
        }
      }

      // Deduplicate and sort alphabetically (case-insensitive)
      const uniqueColours = [...new Set(allColours.map(v => v.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      const uniqueMaterials = [...new Set(allMaterials.map(v => v.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      const uniqueMade = [...new Set(allMade.map(v => v.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );

      return NextResponse.json({
        colours: uniqueColours,
        materials: uniqueMaterials,
        made: uniqueMade,
      });
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

    /**
     * Helper: apply common filters (material, colour, made, price) to a query.
     *
     * NOTE on JSONB filtering (materials, colours):
     * - The `cs` (contains, @>) operator is case-sensitive: '"blue"' won't match '["Blue"]'.
     * - PostgreSQL's `ilike` doesn't work on JSONB columns directly.
     * - For text columns (made), ilike works natively and is case-insensitive.
     *
     * Strategy for JSONB fields:
     * - We do NOT apply JSONB filters at the database level.
     * - Instead, we fetch all rows that match the other filters,
     *   then filter JSONB fields (colour, material) in JavaScript with
     *   case-insensitive matching.
     * - This is acceptable because the other filters (search, made, price)
     *   already narrow down the result set significantly.
     */
    const applyCommonFilters = (q: any) => {
      // JSONB filters (colour, material) are applied post-fetch in JS — see below
      if (made) q = q.ilike('made', `%${made}%`);
      if (priceMin) q = q.gte('price', parseFloat(priceMin));
      if (priceMax) q = q.lte('price', parseFloat(priceMax));
      return q;
    };

    /**
     * Case-insensitive JSONB array filter.
     * Checks if any value in the JSONB array contains the search string,
     * ignoring case. Handles both parsed arrays and JSON strings.
     */
    const jsonbContainsIgnoreCase = (fieldValue: any, searchTerm: string): boolean => {
      if (!fieldValue || !searchTerm) return false;
      const searchLower = searchTerm.toLowerCase().trim();
      let arr: string[];
      if (Array.isArray(fieldValue)) {
        arr = fieldValue;
      } else if (typeof fieldValue === 'string') {
        try {
          const parsed = JSON.parse(fieldValue);
          arr = Array.isArray(parsed) ? parsed : [fieldValue];
        } catch {
          arr = fieldValue.split(/[,;|]/);
        }
      } else {
        return false;
      }
      return arr.some(v => String(v).toLowerCase().trim().includes(searchLower));
    };

    // ── When searching: use two-query approach to guarantee ND number matches appear first ──
    // This handles the cross-page issue where ND-matching products might be on page 2+.
    if (search && !ndNumber) {
      // Query A: Fetch ALL products where nd_number matches the search (no pagination)
      // These will always be shown first regardless of which page they'd normally be on.
      let ndQuery = supabase
        .from('products')
        .select('*, product_images(*)')
        .ilike('nd_number', `%${search}%`)
        .order(sortColumn, { ascending: sortAscending, nullsFirst: true })
        .limit(500);
      ndQuery = applyCommonFilters(ndQuery);

      // Query B: Count total matching products (both ND and non-ND)
      // Note: materials and colours are JSONB, so we can't use ilike on them.
      // Search only covers text columns: nd_number, barcode, english_description, arabic_description.
      let countQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .or(
          `nd_number.ilike.%${search}%,barcode.ilike.%${search}%,english_description.ilike.%${search}%,arabic_description.ilike.%${search}%`
        );
      countQuery = applyCommonFilters(countQuery);

      const [ndResult, countResult] = await Promise.all([ndQuery, countQuery]);

      if (ndResult.error) {
        console.error('Supabase error fetching ND products:', ndResult.error);
        return NextResponse.json({ error: ndResult.error.message }, { status: 500 });
      }
      if (countResult.error) {
        console.error('Supabase error counting products:', countResult.error);
        return NextResponse.json({ error: countResult.error.message }, { status: 500 });
      }

      let ndProducts = (ndResult.data || []).map(mapProductFromDb);

      // Apply case-insensitive JSONB filters
      if (colour) ndProducts = ndProducts.filter(p => jsonbContainsIgnoreCase(p.colours, colour));
      if (material) ndProducts = ndProducts.filter(p => jsonbContainsIgnoreCase(p.materials, material));

      const ndCount = ndProducts.length;
      const totalCount = countResult.count || 0;

      // Sort ND matches by priority: exact → starts-with → contains
      const searchLower = search.toLowerCase();
      ndProducts.sort((a, b) => {
        const aNd = (a.ndNumber || '').toLowerCase();
        const bNd = (b.ndNumber || '').toLowerCase();
        const aPriority = aNd === searchLower ? 0 : aNd.startsWith(searchLower) ? 1 : 2;
        const bPriority = bNd === searchLower ? 0 : bNd.startsWith(searchLower) ? 1 : 2;
        if (aPriority !== bPriority) return aPriority - bPriority;
        // Within same priority, preserve sort column order
        return 0;
      });

      const ndProductIds = new Set(ndProducts.map(p => p.id));

      // Calculate how many ND products appear on this page
      const pageStart = (page - 1) * limit;
      const pageEnd = page * limit;
      const ndOnThisPage = ndProducts.slice(pageStart, pageEnd);
      const remainingSlots = limit - ndOnThisPage.length;

      // Query C: Fetch non-ND matching products to fill remaining slots on this page
      let otherProducts: any[] = [];
      if (remainingSlots > 0) {
        // Calculate offset into the non-ND results
        // If ndCount > pageStart, some ND products took slots on this page
        // The non-ND offset is: pageStart minus however many ND products preceded this page
        const ndBeforeThisPage = Math.min(ndCount, pageStart);
        const nonNdOffset = pageStart - ndBeforeThisPage;

        let nonNdQuery = supabase
          .from('products')
          .select('*, product_images(*)')
          .or(
            `barcode.ilike.%${search}%,english_description.ilike.%${search}%,arabic_description.ilike.%${search}%`
          )
          .not('nd_number', 'ilike', `%${search}%`)
          .order(sortColumn, { ascending: sortAscending, nullsFirst: true })
          .range(nonNdOffset, nonNdOffset + remainingSlots - 1);
        nonNdQuery = applyCommonFilters(nonNdQuery);

        const { data: nonNdData, error: nonNdError } = await nonNdQuery;
        if (nonNdError) {
          console.error('Supabase error fetching non-ND products:', nonNdError);
          return NextResponse.json({ error: nonNdError.message }, { status: 500 });
        }
        otherProducts = (nonNdData || []).map(mapProductFromDb);

        // Apply case-insensitive JSONB filters to non-ND results
        if (colour) otherProducts = otherProducts.filter(p => jsonbContainsIgnoreCase(p.colours, colour));
        if (material) otherProducts = otherProducts.filter(p => jsonbContainsIgnoreCase(p.materials, material));
      }

      // Combine: ND matches for this page first, then non-ND matches
      const products = [...ndOnThisPage, ...otherProducts];

      return NextResponse.json({ products, total: totalCount, page, limit });
    }

    // ── No search (or ndNumber filter): standard paginated query ──
    // When JSONB filters (colour/material) are active, we need to handle
    // pagination differently because DB-level count/pagination doesn't
    // account for JS-level filtering.
    if (colour || material) {
      // Fetch a larger batch and filter in JS, then paginate manually
      const fetchLimit = 2000; // fetch enough to cover typical filter results
      let query = supabase
        .from('products')
        .select('*, product_images(*)')
        .order(sortColumn, { ascending: sortAscending, nullsFirst: true })
        .limit(fetchLimit);
      query = applyCommonFilters(query);

      if (search) {
        query = query.or(
          `nd_number.ilike.%${search}%,barcode.ilike.%${search}%,english_description.ilike.%${search}%,arabic_description.ilike.%${search}%`
        );
      }
      if (ndNumber) {
        query = query.ilike('nd_number', ndNumber);
      }

      const { data: allData, error: allError } = await query;

      if (allError) {
        console.error('Supabase error fetching products:', allError);
        return NextResponse.json({ error: allError.message }, { status: 500 });
      }

      let allProducts = (allData || []).map(mapProductFromDb);

      // Apply case-insensitive JSONB filters
      if (colour) allProducts = allProducts.filter(p => jsonbContainsIgnoreCase(p.colours, colour));
      if (material) allProducts = allProducts.filter(p => jsonbContainsIgnoreCase(p.materials, material));

      const total = allProducts.length;
      const pageStart = (page - 1) * limit;
      const pageEnd = page * limit;
      const products = allProducts.slice(pageStart, pageEnd);

      return NextResponse.json({ products, total, page, limit });
    }

    // ── Standard path (no JSONB filters) ──
    let query = supabase
      .from('products')
      .select('*, product_images(*)', { count: 'exact' })
      .order(sortColumn, { ascending: sortAscending, nullsFirst: true })
      .range((page - 1) * limit, page * limit - 1);

    // Search filter (OR across text fields) — only when ndNumber filter is used with search
    if (search) {
      query = query.or(
        `nd_number.ilike.%${search}%,barcode.ilike.%${search}%,english_description.ilike.%${search}%,arabic_description.ilike.%${search}%`
      );
    }

    // Filter by specific ND Number (for grouping) — case-insensitive
    if (ndNumber) {
      query = query.ilike('nd_number', ndNumber);
    }

    query = applyCommonFilters(query);

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
