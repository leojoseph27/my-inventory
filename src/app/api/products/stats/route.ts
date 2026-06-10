import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Products added today
    const { count: productsAddedToday } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Products missing images - products with no rows in product_images
    const { data: productsWithImages } = await supabase
      .from('products')
      .select('id, product_images(id)');
    
    const productsMissingImages = (productsWithImages || []).filter(
      (p: any) => !p.product_images || p.product_images.length === 0
    ).length;

    // Products missing barcode
    const { count: productsMissingBarcode } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .is('barcode', null);

    // Products missing dimensions
    const { count: missingLength } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .is('length', null);
    
    const { count: missingWidth } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .is('width', null);

    const { count: missingHeight } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .is('height', null);

    // Products missing any dimension = union of the three
    // Use a simpler approach: count products where at least one dimension is null
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, length, width, height');
    
    const productsMissingDimensions = (allProducts || []).filter(
      (p: any) => p.length === null || p.width === null || p.height === null
    ).length;

    return NextResponse.json({
      totalProducts: totalProducts || 0,
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
