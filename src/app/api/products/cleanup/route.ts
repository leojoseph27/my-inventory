import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

export async function DELETE() {
  try {
    const supabase = createAdminClient();

    // Find ghost products (no identifying data)
    const { data: ghostProducts, error: fetchError } = await supabase
      .from('products')
      .select('*, product_images(*)')
      .is('english_description', null)
      .is('arabic_description', null)
      .is('nd_number', null)
      .is('barcode', null)
      .is('sr', null);

    if (fetchError) {
      console.error('Error fetching ghost products:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!ghostProducts || ghostProducts.length === 0) {
      return NextResponse.json({ message: 'No ghost products found to clean up', deleted: 0 });
    }

    // Delete images from Supabase Storage
    for (const product of ghostProducts) {
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
          await supabase.storage.from('product-images').remove(filePaths);
        }
      }
    }

    // Delete ghost products
    const ghostIds = ghostProducts.map((p: any) => p.id);
    const { error: deleteError, count } = await supabase
      .from('products')
      .delete()
      .in('id', ghostIds);

    if (deleteError) {
      console.error('Error deleting ghost products:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Cleaned up ${ghostIds.length} ghost products`,
      deleted: ghostIds.length,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({ error: 'Failed to clean up ghost products' }, { status: 500 });
  }
}
