import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

    let imported = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const parseArrayField = (value: any): string[] | null => {
          if (!value) return null;
          if (Array.isArray(value)) return value;
          const str = String(value).trim();
          if (!str) return null;
          return str.split(',').map((v: string) => v.trim()).filter(Boolean);
        };

        await db.product.create({
          data: {
            sr: row['Sr'] != null ? Number(row['Sr']) : null,
            englishDescription: row['English Description'] ? String(row['English Description']) : null,
            arabicDescription: row['Arabic Description'] ? String(row['Arabic Description']) : null,
            ndNumber: row['ND Number'] ? String(row['ND Number']) : null,
            barcode: row['Barcode'] ? String(row['Barcode']) : null,
            colours: parseArrayField(row['Colour']) ? JSON.stringify(parseArrayField(row['Colour'])) : null,
            length: row['L'] != null ? Number(row['L']) : null,
            width: row['W'] != null ? Number(row['W']) : null,
            height: row['H'] != null ? Number(row['H']) : null,
            made: row['Made'] ? String(row['Made']) : null,
            materials: parseArrayField(row['Material']) ? JSON.stringify(parseArrayField(row['Material'])) : null,
            additionalInfo: parseArrayField(row['Additional Info']) ? JSON.stringify(parseArrayField(row['Additional Info'])) : null,
            price: row['Price'] != null ? Number(row['Price']) : null,
            pcs: row['Pcs'] != null ? Number(row['Pcs']) : null,
          },
        });
        imported++;
      } catch (err) {
        console.error('Error importing row:', err);
        errors++;
      }
    }

    return NextResponse.json({ imported, errors, total: rows.length });
  } catch (error) {
    console.error('Error importing Excel:', error);
    return NextResponse.json({ error: 'Failed to import Excel file' }, { status: 500 });
  }
}
