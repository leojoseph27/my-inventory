import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { mapProductFromDb } from '@/utils/supabase/mappers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const ndNumber = searchParams.get('ndNumber') || '';
    const barcode = searchParams.get('barcode') || '';
    const excludeId = searchParams.get('excludeId') || '';

    const duplicates: { ndNumber?: any; barcode?: any } = {};

    if (ndNumber) {
      let query = supabase
        .from('products')
        .select('id, sr, english_description, nd_number')
        .eq('nd_number', ndNumber)
        .limit(1);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const row = data[0];
        duplicates.ndNumber = {
          id: row.id,
          sr: row.sr,
          englishDescription: row.english_description,
          ndNumber: row.nd_number,
        };
      }
    }

    if (barcode) {
      let query = supabase
        .from('products')
        .select('id, sr, english_description, barcode')
        .eq('barcode', barcode)
        .limit(1);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const row = data[0];
        duplicates.barcode = {
          id: row.id,
          sr: row.sr,
          englishDescription: row.english_description,
          barcode: row.barcode,
        };
      }
    }

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
