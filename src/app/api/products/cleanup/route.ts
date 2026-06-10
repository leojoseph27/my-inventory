import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

/**
 * DELETE /api/products/cleanup
 *
 * Query param:
 *   ?mode=all  — delete ALL products, product_images, and storage files
 *   (default)  — delete only ghost products (no identifying data)
 */
export async function DELETE(request: Request) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    // ── Full wipe mode ──
    if (mode === 'all') {
      let imagesDeleted = 0;
      let storageFilesDeleted = 0;

      // 1. Fetch all product_images to clean up storage
      const { data: allImages } = await supabase
        .from('product_images')
        .select('image_url');

      // 2. Delete files from Supabase Storage bucket
      if (allImages && allImages.length > 0) {
        const filePaths = allImages
          .map((img: any) => {
            try {
              const url = new URL(img.image_url);
              const parts = url.pathname.split('/');
              return parts.slice(parts.indexOf('product-images') + 1).join('/');
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (filePaths.length > 0) {
          const { data: removeResult, error: storageError } = await supabase
            .storage
            .from('product-images')
            .remove(filePaths);

          if (!storageError) {
            storageFilesDeleted = filePaths.length;
          } else {
            console.warn('[CLEANUP ALL] Storage delete error:', storageError.message);
          }
        }
      }

      // 3. Also remove any remaining folders in the bucket
      const { data: bucketFolders } = await supabase.storage
        .from('product-images')
        .list('', { limit: 1000 });

      if (bucketFolders && bucketFolders.length > 0) {
        for (const folder of bucketFolders) {
          if (folder.id) {
            // It's a file, delete directly
            await supabase.storage.from('product-images').remove([folder.name]);
            storageFilesDeleted++;
          } else {
            // It's a folder, list and delete contents
            const { data: folderFiles } = await supabase.storage
              .from('product-images')
              .list(folder.name, { limit: 1000 });

            if (folderFiles && folderFiles.length > 0) {
              const innerPaths = folderFiles.map(f => `${folder.name}/${f.name}`);
              const { error } = await supabase.storage.from('product-images').remove(innerPaths);
              if (!error) storageFilesDeleted += innerPaths.length;
            }
          }
        }
      }

      // 4. Delete all product_images rows (must be before products due to FK)
      const { count: imgCount, error: imgDelError } = await supabase
        .from('product_images')
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // match all rows

      imagesDeleted = imgCount ?? 0;

      if (imgDelError) {
        console.warn('[CLEANUP ALL] product_images delete error:', imgDelError.message);
      }

      // 5. Delete all products in batches (Supabase REST may paginate)
      let productsDeleted = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch, error: fetchErr } = await supabase
          .from('products')
          .select('id')
          .limit(500);

        if (fetchErr || !batch || batch.length === 0) {
          hasMore = false;
          break;
        }

        const ids = batch.map((p: any) => p.id);
        const { count, error: delErr } = await supabase
          .from('products')
          .delete({ count: 'exact' })
          .in('id', ids);

        productsDeleted += count ?? ids.length;

        if (delErr) {
          console.warn('[CLEANUP ALL] Products batch delete error:', delErr.message);
          hasMore = false;
        } else if (batch.length < 500) {
          hasMore = false;
        }
      }

      console.log(`[CLEANUP ALL] Done: ${productsDeleted} products, ${imagesDeleted} images, ${storageFilesDeleted} storage files`);

      return NextResponse.json({
        message: `Deleted all data: ${productsDeleted} products, ${imagesDeleted} images, ${storageFilesDeleted} storage files`,
        productsDeleted,
        imagesDeleted,
        storageFilesDeleted,
      });
    }

    // ── Ghost-only mode (default) ──
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

    const ghostIds = ghostProducts.map((p: any) => p.id);
    const { error: deleteError } = await supabase
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
    return NextResponse.json({ error: 'Failed to clean up' }, { status: 500 });
  }
}
