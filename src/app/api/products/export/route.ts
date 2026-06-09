import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import * as XLSX from 'xlsx';

/**
 * Excel Export Route — Two-Row Header with Merged "SIZE mm" Group
 *
 * Recreates the user's Excel template format:
 *
 *   Row 1: sr | English Description | Arabic Description | ND Number | barcode | Colour | SIZE mm | Made | Material | Additional INFO | PRICE | Pcs | Photo
 *   Row 2:    |                     |                     |           |         |         | L | W | H      |         |                 |       |     |
 *
 * "SIZE mm" spans 3 columns (L, W, H) as a merged cell.
 * Data rows start at Row 3.
 *
 * Supabase snake_case → Excel header mapping:
 *   sr → sr
 *   english_description → English Description
 *   arabic_description → Arabic Description
 *   nd_number → ND Number
 *   barcode → barcode
 *   colours → Colour (JSON array → comma-separated string)
 *   length → L (under SIZE mm)
 *   width → W (under SIZE mm)
 *   height → H (under SIZE mm)
 *   made → Made
 *   materials → Material (JSON array → comma-separated string)
 *   additional_info → Additional INFO (JSON array → comma-separated string)
 *   price → PRICE
 *   pcs → Pcs
 *   photo → Photo
 */

// Column layout definition (in order of appearance in the Excel)
// colIndex is the 0-based column position in the worksheet
interface ColDef {
  header1: string;   // Row 1 header text (parent header or the main header)
  header2: string;   // Row 2 header text (sub-header or empty)
  dbField: string;   // Supabase snake_case column name
  isJsonArray?: boolean;
}

const COLUMN_DEFS: ColDef[] = [
  { header1: 'sr', header2: '', dbField: 'sr' },
  { header1: 'English Description', header2: '', dbField: 'english_description' },
  { header1: 'Arabic Description', header2: '', dbField: 'arabic_description' },
  { header1: 'ND Number', header2: '', dbField: 'nd_number' },
  { header1: 'barcode', header2: '', dbField: 'barcode' },
  { header1: 'Colour', header2: '', dbField: 'colours', isJsonArray: true },
  // SIZE mm group — parent header spans 3 columns
  { header1: 'SIZE mm', header2: 'L', dbField: 'length' },
  { header1: '',        header2: 'W', dbField: 'width' },
  { header1: '',        header2: 'H', dbField: 'height' },
  { header1: 'Made', header2: '', dbField: 'made' },
  { header1: 'Material', header2: '', dbField: 'materials', isJsonArray: true },
  { header1: 'Additional INFO', header2: '', dbField: 'additional_info', isJsonArray: true },
  { header1: 'PRICE', header2: '', dbField: 'price' },
  { header1: 'Pcs', header2: '', dbField: 'pcs' },
  { header1: 'Photo', header2: '', dbField: 'photo' },
];

/**
 * Parse a JSON array field back to a comma-separated string for Excel.
 * '["Red","Blue"]' → "Red, Blue"
 */
function jsonArrayToString(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) return arr.join(', ');
    return String(value);
  } catch {
    return String(value);
  }
}

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

    // ── Create workbook and worksheet ──
    const workbook = XLSX.utils.book_new();
    const worksheet: XLSX.WorkSheet = {};

    const totalCols = COLUMN_DEFS.length;
    const totalRows = (data || []).length;
    const maxRow = totalRows + 2; // +2 for the two header rows (0-indexed: rows 0,1=headers, 2+=data)

    // ── Write Row 1 (parent headers) and Row 2 (sub-headers) ──
    for (let c = 0; c < totalCols; c++) {
      const col = COLUMN_DEFS[c];
      const cellRef1 = XLSX.utils.encode_cell({ r: 0, c });
      const cellRef2 = XLSX.utils.encode_cell({ r: 1, c });

      if (col.header1) {
        worksheet[cellRef1] = { t: 's', v: col.header1 };
      }
      if (col.header2) {
        worksheet[cellRef2] = { t: 's', v: col.header2 };
      }
    }

    // ── Write data rows starting at row index 2 ──
    for (let r = 0; r < totalRows; r++) {
      const product = data[r];
      for (let c = 0; c < totalCols; c++) {
        const col = COLUMN_DEFS[c];
        const cellRef = XLSX.utils.encode_cell({ r: r + 2, c });
        let value = product[col.dbField] ?? '';

        if (col.isJsonArray) {
          value = jsonArrayToString(value);
        }

        // Determine cell type
        if (value === '' || value === null || value === undefined) {
          worksheet[cellRef] = { t: 's', v: '' };
        } else if (typeof value === 'number') {
          worksheet[cellRef] = { t: 'n', v: value };
        } else {
          worksheet[cellRef] = { t: 's', v: String(value) };
        }
      }
    }

    // ── Set worksheet range ──
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(maxRow - 1, 1), c: totalCols - 1 },
    });

    // ── Merge "SIZE mm" across 3 columns in Row 1 ──
    // Find the column indices for the SIZE mm group
    const sizeStartCol = COLUMN_DEFS.findIndex(c => c.header1 === 'SIZE mm');
    if (sizeStartCol !== -1) {
      worksheet['!merges'] = [
        {
          s: { r: 0, c: sizeStartCol },
          e: { r: 0, c: sizeStartCol + 2 }, // spans 3 columns (L, W, H)
        },
      ];
    }

    // ── Set column widths ──
    worksheet['!cols'] = [
      { wch: 6 },   // sr
      { wch: 30 },  // English Description
      { wch: 30 },  // Arabic Description
      { wch: 12 },  // ND Number
      { wch: 18 },  // barcode
      { wch: 20 },  // Colour
      { wch: 8 },   // L
      { wch: 8 },   // W
      { wch: 8 },   // H
      { wch: 12 },  // Made
      { wch: 20 },  // Material
      { wch: 25 },  // Additional INFO
      { wch: 10 },  // PRICE
      { wch: 6 },   // Pcs
      { wch: 30 },  // Photo
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

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
