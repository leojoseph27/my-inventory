import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { mapImageFromDb } from '@/utils/supabase/mappers';

/**
 * POST /api/images/upload
 *
 * Upload an image to Supabase Storage and create a product_images record.
 *
 * Form data:
 *   file      — The image file (required)
 *   productId — The product ID to link the image to (required)
 *   isPrimary — Whether this should be the primary image (optional, default: false)
 *
 * Workflow:
 *   1. Receive file + productId from FormData
 *   2. Upload file to Supabase Storage bucket "product-images"
 *      Path: {productId}/{timestamp}_{filename}
 *   3. Get the public URL of the uploaded file
 *   4. Insert a row into product_images table
 *   5. Return the image record
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // ── Parse form data ──
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productId = formData.get('productId') as string | null;
    const isPrimary = formData.get('isPrimary') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!productId) {
      return NextResponse.json({ error: 'No productId provided' }, { status: 400 });
    }

    // ── Validate file type ──
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only images are allowed.` },
        { status: 400 }
      );
    }

    // ── Build storage path ──
    // Format: {productId}/{timestamp}_{originalFilename}
    const timestamp = Date.now();
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = sanitized.includes('.') ? sanitized.substring(sanitized.lastIndexOf('.')) : '.jpg';
    const storagePath = `${productId}/${timestamp}${ext}`;

    // ── If this is the first image for the product, auto-set as primary ──
    let shouldBePrimary = isPrimary;
    if (!shouldBePrimary) {
      const { count } = await supabase
        .from('product_images')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', parseInt(productId));
      if (count === 0) {
        shouldBePrimary = true;
      }
    }

    // ── If setting as primary, unset other primaries ──
    if (shouldBePrimary) {
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', parseInt(productId))
        .eq('is_primary', true);
    }

    // ── Get current max display_order ──
    const { data: existingImages } = await supabase
      .from('product_images')
      .select('display_order')
      .eq('product_id', parseInt(productId))
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existingImages && existingImages.length > 0
      ? (existingImages[0] as any).display_order + 1
      : 0;

    // ── Upload to Supabase Storage ──
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('[UPLOAD] Storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // ── Build public URL ──
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath);

    const imageUrl = urlData.publicUrl;

    // ── Insert product_images record ──
    const { data: imageRecord, error: dbError } = await supabase
      .from('product_images')
      .insert({
        product_id: parseInt(productId),
        image_url: imageUrl,
        display_order: nextOrder,
        is_primary: shouldBePrimary,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[UPLOAD] DB insert error:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from('product-images').remove([storagePath]);
      return NextResponse.json(
        { error: `Database insert failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log(`[UPLOAD] Success: product ${productId}, path ${storagePath}, primary ${shouldBePrimary}`);

    return NextResponse.json(mapImageFromDb(imageRecord), { status: 201 });
  } catch (error) {
    console.error('[UPLOAD] Fatal error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
