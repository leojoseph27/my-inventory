import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      productsAddedToday,
      productsMissingImages,
      productsMissingBarcode,
      productsMissingDimensions,
    ] = await Promise.all([
      db.product.count(),
      db.product.count({
        where: { createdAt: { gte: today } },
      }),
      db.product.count({
        where: { images: { none: {} } },
      }),
      db.product.count({
        where: { barcode: null },
      }),
      db.product.count({
        where: {
          OR: [
            { length: null },
            { width: null },
            { height: null },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      totalProducts,
      productsAddedToday,
      productsMissingImages,
      productsMissingBarcode,
      productsMissingDimensions,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
