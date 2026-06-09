import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const products = await db.product.findMany({
      include: { images: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { sr: 'asc' },
    });

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

    const rows = products.map((p) => ({
      'Sr': p.sr ?? '',
      'English Description': p.englishDescription ?? '',
      'Arabic Description': p.arabicDescription ?? '',
      'ND Number': p.ndNumber ?? '',
      'Barcode': p.barcode ?? '',
      'Colour': parseJsonArray(p.colours),
      'L': p.length ?? '',
      'W': p.width ?? '',
      'H': p.height ?? '',
      'Made': p.made ?? '',
      'Material': parseJsonArray(p.materials),
      'Additional Info': parseJsonArray(p.additionalInfo),
      'Price': p.price ?? '',
      'Pcs': p.pcs ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },   // Sr
      { wch: 30 },  // English Description
      { wch: 30 },  // Arabic Description
      { wch: 12 },  // ND Number
      { wch: 18 },  // Barcode
      { wch: 20 },  // Colour
      { wch: 8 },   // L
      { wch: 8 },   // W
      { wch: 8 },   // H
      { wch: 12 },  // Made
      { wch: 20 },  // Material
      { wch: 25 },  // Additional Info
      { wch: 10 },  // Price
      { wch: 6 },   // Pcs
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
