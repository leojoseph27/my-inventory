import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { mapProductFromDb, mapProductToDb } from '@/utils/supabase/mappers';

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
      .update(dbData)
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
        const url = new URL(img.image_url);
        const pathParts = url.pathname.split('/');
        return pathParts.slice(pathParts.indexOf('product-images') + 1).join('/');
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
