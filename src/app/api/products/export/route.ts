import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('products')
      .select('*, product_images(*)')
      .order('sr', { ascending: true, nullsFirst: true });

    if (error) {
      console.error('Supabase error exporting products:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const parseJsonArray = (value: string | null): string => {
      if (!value) return '';
      try {
        const arr = JSON.parse(value);
        if (Array.isArray(arr)) return arr.join(', ');
        return String(value);
      } catch {
        return String(value);
      }
    };

    const rows = (data || []).map((p: any) => ({
      'Sr': p.sr ?? '',
      'English Description': p.english_description ?? '',
      'Arabic Description': p.arabic_description ?? '',
      'ND Number': p.nd_number ?? '',
      'Barcode': p.barcode ?? '',
      'Colour': parseJsonArray(p.colours),
      'L': p.length ?? '',
      'W': p.width ?? '',
      'H': p.height ?? '',
      'Made': p.made ?? '',
      'Material': parseJsonArray(p.materials),
      'Additional Info': parseJsonArray(p.additional_info),
      'Price': p.price ?? '',
      'Pcs': p.pcs ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    worksheet['!cols'] = [
      { wch: 6 }, { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 18 },
      { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
      { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 6 },
    ];

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="products_export.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error exporting Excel:', error);
    return NextResponse.json({ error: 'Failed to export Excel file' }, { status: 500 });
  }
}
