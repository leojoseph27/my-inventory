import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { mapProductFromDb, mapProductToDb } from '@/utils/supabase/mappers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const material = searchParams.get('material') || '';
    const colour = searchParams.get('colour') || '';
    const made = searchParams.get('made') || '';
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build the query
    let query = supabase
      .from('products')
      .select('*, product_images(*)', { count: 'exact' })
      .order('sr', { ascending: true, nullsFirst: true })
      .range((page - 1) * limit, page * limit - 1);

    // Search filter (OR across multiple fields)
    if (search) {
      query = query.or(
        `nd_number.ilike.%${search}%,barcode.ilike.%${search}%,english_description.ilike.%${search}%,arabic_description.ilike.%${search}%,materials.ilike.%${search}%,colours.ilike.%${search}%`
      );
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
      colours: body.colours ? JSON.stringify(body.colours) : null,
      length: body.length ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
      made: body.made || null,
      materials: body.materials ? JSON.stringify(body.materials) : null,
      additionalInfo: body.additionalInfo ? JSON.stringify(body.additionalInfo) : null,
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
