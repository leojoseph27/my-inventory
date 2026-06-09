import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DELETE /api/products/cleanup
 * Removes all products that have no identifying data (englishDescription, ndNumber, sr are all null).
 * Also deletes their associated images.
 */
export async function DELETE() {
  try {
    // Find ghost products (no identifying data at all)
    const ghostProducts = await db.product.findMany({
      where: {
        englishDescription: null,
        arabicDescription: null,
        ndNumber: null,
        barcode: null,
        sr: null,
      },
      include: { images: true },
    });

    if (ghostProducts.length === 0) {
      return NextResponse.json({ message: 'No ghost products found to clean up', deleted: 0 });
    }

    // Delete ghost product image files
    for (const product of ghostProducts) {
      for (const image of product.images) {
        try {
          const filePath = join(process.cwd(), 'upload', 'products', image.imageUrl.split('/').pop() || '');
          if (existsSync(filePath)) unlinkSync(filePath);
        } catch (e) {
          // Ignore file deletion errors
        }
      }
    }

    // Delete ghost products (cascade deletes images from DB)
    const result = await db.product.deleteMany({
      where: {
        englishDescription: null,
        arabicDescription: null,
        ndNumber: null,
        barcode: null,
        sr: null,
      },
    });

    return NextResponse.json({
      message: `Cleaned up ${result.count} ghost products`,
      deleted: result.count,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({ error: 'Failed to clean up ghost products' }, { status: 500 });
  }
}
