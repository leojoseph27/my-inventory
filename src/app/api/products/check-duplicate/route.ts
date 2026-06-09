import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ndNumber = searchParams.get('ndNumber') || '';
    const barcode = searchParams.get('barcode') || '';
    const excludeId = searchParams.get('excludeId') || '';

    const duplicates: { ndNumber?: any; barcode?: any } = {};

    if (ndNumber) {
      const existing = await db.product.findFirst({
        where: {
          ndNumber,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existing) {
        duplicates.ndNumber = { id: existing.id, sr: existing.sr, englishDescription: existing.englishDescription, ndNumber: existing.ndNumber };
      }
    }

    if (barcode) {
      const existing = await db.product.findFirst({
        where: {
          barcode,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existing) {
        duplicates.barcode = { id: existing.id, sr: existing.sr, englishDescription: existing.englishDescription, barcode: existing.barcode };
      }
    }

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
