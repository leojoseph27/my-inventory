import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { mapImageFromDb } from '@/utils/supabase/mappers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Get image record
    const { data: image, error: fetchError } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Delete from Supabase Storage
    try {
      const url = new URL(image.image_url);
      const pathParts = url.pathname.split('/');
      const storagePath = pathParts.slice(pathParts.indexOf('product-images') + 1).join('/');
      
      if (storagePath) {
        await supabase.storage.from('product-images').remove([storagePath]);
      }
    } catch (e) {
      console.error('Error deleting image from storage:', e);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('product_images')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting image record:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const body = await request.json();

    // If setting as primary, unset other primaries for the same product
    if (body.isPrimary) {
      const { data: image } = await supabase
        .from('product_images')
        .select('product_id')
        .eq('id', id)
        .single();

      if (image) {
        await supabase
          .from('product_images')
          .update({ is_primary: false })
          .eq('product_id', (image as any).product_id)
          .eq('is_primary', true);
      }
    }

    // Build update data
    const updateData: Record<string, any> = {};
    if (body.isPrimary !== undefined) updateData.is_primary = body.isPrimary;
    if (body.displayOrder !== undefined) updateData.display_order = body.displayOrder;

    const { data: updatedImage, error } = await supabase
      .from('product_images')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating image:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapImageFromDb(updatedImage));
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 });
  }
}
