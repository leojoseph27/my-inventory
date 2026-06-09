import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { mapImageFromDb } from '@/utils/supabase/mappers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const productId = formData.get('productId') as string;
    const isPrimary = formData.get('isPrimary') === 'true';

    if (!file || !productId) {
      return NextResponse.json({ error: 'File and productId are required' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${productId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const storagePath = `${productId}/${filename}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image: ' + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath);

    const imageUrl = urlData.publicUrl;

    // Get current max display_order for this product
    const { data: existingImages } = await supabase
      .from('product_images')
      .select('display_order')
      .eq('product_id', productId)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existingImages && existingImages.length > 0
      ? (existingImages[0] as any).display_order + 1
      : 0;

    // If this is primary, unset other primaries
    if (isPrimary) {
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId)
        .eq('is_primary', true);
    }

    // Create image record
    const { data: imageData, error: insertError } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        image_url: imageUrl,
        display_order: nextOrder,
        is_primary: isPrimary || nextOrder === 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert image error:', insertError);
      return NextResponse.json({ error: 'Failed to save image record: ' + insertError.message }, { status: 500 });
    }

    return NextResponse.json(mapImageFromDb(imageData), { status: 201 });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
