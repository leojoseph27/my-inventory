import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Case-insensitive column mapping: Excel header → database field
// Supports multiple possible Excel header variations
const COLUMN_MAPPINGS: { patterns: string[]; field: string; type: 'number' | 'string' | 'array' }[] = [
  { patterns: ['sr', 'Sr', 'SR', 's.r', 'S.R', 'serial', 'Serial', 'no', 'No', '#'], field: 'sr', type: 'number' },
  { patterns: ['english description', 'englishdescription', 'english_description', 'english desc', 'description', 'desc', 'english_desc', 'product description', 'name'], field: 'englishDescription', type: 'string' },
  { patterns: ['arabic description', 'arabicdescription', 'arabic_description', 'arabic desc', 'arabic_desc', 'arabic', 'arab description'], field: 'arabicDescription', type: 'string' },
  { patterns: ['nd number', 'ndnumber', 'nd_number', 'nd no', 'ndno', 'nd_no', 'nd', 'ND Number', 'ND'], field: 'ndNumber', type: 'string' },
  { patterns: ['barcode', 'Barcode', 'BARCODE', 'bar code', 'bar_code', 'ean', 'upc', 'code', 'Code'], field: 'barcode', type: 'string' },
  { patterns: ['colour', 'color', 'Colour', 'Color', 'COLOUR', 'COLOR', 'colours', 'colors'], field: 'colours', type: 'array' },
  { patterns: ['l', 'L', 'length', 'Length', 'LENGTH', 'len', 'Lng', 'long', 'dimension l'], field: 'length', type: 'number' },
  { patterns: ['w', 'W', 'width', 'Width', 'WIDTH', 'wid', 'dimension w'], field: 'width', type: 'number' },
  { patterns: ['h', 'H', 'height', 'Height', 'HEIGHT', 'ht', 'dimension h'], field: 'height', type: 'number' },
  { patterns: ['made', 'Made', 'MADE', 'made in', 'Made In', 'made_in', 'origin', 'country', 'country of origin'], field: 'made', type: 'string' },
  { patterns: ['material', 'Material', 'MATERIAL', 'materials', 'Materials', 'MATERIALS', 'mat'], field: 'materials', type: 'array' },
  { patterns: ['additional info', 'additionalinfo', 'additional_info', 'additional information', 'additionalinfo', 'add info', 'add_info', 'additional', 'extra info', 'extra_info', 'additional info', 'additional information', 'info', 'notes', 'extra'], field: 'additionalInfo', type: 'array' },
  { patterns: ['price', 'Price', 'PRICE', 'unit price', 'unitprice', 'unit_price', 'cost', 'amount', 'rate'], field: 'price', type: 'number' },
  { patterns: ['pcs', 'Pcs', 'PCS', 'pieces', 'Pieces', 'PIECES', 'piece', 'qty', 'quantity', 'Quantity', 'QTY', 'units', 'stock'], field: 'pcs', type: 'number' },
];

/**
 * Finds the matching field name from a row object using case-insensitive matching.
 * Normalizes both the Excel header and the pattern by lowercasing and removing spaces/underscores.
 */
function findFieldValue(row: Record<string, any>, patterns: string[]): { key: string; value: any } | null {
  // First pass: exact match (case-sensitive, fastest)
  for (const pattern of patterns) {
    if (row[pattern] !== undefined) {
      return { key: pattern, value: row[pattern] };
    }
  }

  // Second pass: case-insensitive exact match
  const rowKeys = Object.keys(row);
  for (const pattern of patterns) {
    const patternLower = pattern.toLowerCase();
    for (const key of rowKeys) {
      if (key.toLowerCase() === patternLower && row[key] !== undefined) {
        return { key, value: row[key] };
      }
    }
  }

  // Third pass: normalize by removing spaces, underscores, hyphens
  const normalizedPatterns = patterns.map(p => p.toLowerCase().replace(/[\s_-]/g, ''));
  for (const key of rowKeys) {
    const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, '');
    const matchIndex = normalizedPatterns.indexOf(normalizedKey);
    if (matchIndex !== -1 && row[key] !== undefined) {
      return { key, value: row[key] };
    }
  }

  return null;
}

/**
 * Parses a value that should be an array.
 * Handles: comma-separated strings, already-arrays, single values, numbers.
 */
function parseArrayField(value: any): string[] | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.filter(v => String(v).trim());
  const str = String(value).trim();
  if (!str) return null;
  // Split by comma, semicolon, or pipe
  return str.split(/[,;|]/).map(v => v.trim()).filter(Boolean);
}

/**
 * Safely converts a value to a number, returning null if invalid.
 */
function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Safely converts a value to a string, returning null if empty.
 */
function toString(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim() || null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    if (!workbook.SheetNames.length) {
      return NextResponse.json({ error: 'Excel file has no sheets' }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file has no data rows', imported: 0, errors: 0, total: 0 }, { status: 400 });
    }

    // Log detected column headers for debugging
    const detectedHeaders = Object.keys(rows[0]);
    console.log('📥 Import started - File:', file.name, 'Rows:', rows.length);
    console.log('📋 Detected Excel headers:', JSON.stringify(detectedHeaders));

    // Build a column mapping for this specific file
    const mappingResult: Record<string, { field: string; type: string; excelKey: string }> = {};
    for (const mapping of COLUMN_MAPPINGS) {
      const found = findFieldValue(rows[0], mapping.patterns);
      if (found) {
        mappingResult[mapping.field] = {
          field: mapping.field,
          type: mapping.type,
          excelKey: found.key,
        };
      }
    }

    console.log('🗺️ Column mapping:', JSON.stringify(mappingResult));

    // Check for unmapped columns (warn but continue)
    const mappedExcelKeys = new Set(Object.values(mappingResult).map(m => m.excelKey));
    const unmappedColumns = detectedHeaders.filter(h => !mappedExcelKeys.has(h) && h.trim() !== '');
    if (unmappedColumns.length > 0) {
      console.log('⚠️ Unmapped columns (will be ignored):', JSON.stringify(unmappedColumns));
    }

    // Validate: at least one field must be mappable
    if (Object.keys(mappingResult).length === 0) {
      return NextResponse.json({
        error: 'No recognizable column headers found in Excel file. Expected columns like: sr, English Description, Arabic Description, ND Number, barcode, Colour, L, W, H, Made, Material, Additional INFO, PRICE, Pcs',
        detectedHeaders,
        imported: 0,
        errors: 0,
        total: rows.length,
      }, { status: 400 });
    }

    let imported = 0;
    let errors = 0;
    const errorDetails: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Extract values using the mapping
        const record: Record<string, any> = {};

        for (const [dbField, mapInfo] of Object.entries(mappingResult)) {
          const rawValue = row[mapInfo.excelKey];

          switch (mapInfo.type) {
            case 'number':
              record[dbField] = toNumber(rawValue);
              break;
            case 'string':
              record[dbField] = toString(rawValue);
              break;
            case 'array': {
              const arr = parseArrayField(rawValue);
              record[dbField] = arr ? JSON.stringify(arr) : null;
              break;
            }
          }
        }

        // Skip completely empty rows (all mapped fields are null)
        const allFieldsNull = Object.values(record).every(v => v === null || v === undefined);
        if (allFieldsNull) {
          console.log(`⏭️ Row ${i + 2}: Skipped (all fields empty)`);
          continue;
        }

        // Validate: at least englishDescription or ndNumber should exist
        if (!record.englishDescription && !record.ndNumber && !record.sr) {
          console.log(`⚠️ Row ${i + 2}: No identifying field (sr, description, or nd number) - skipping`);
          errors++;
          errorDetails.push({ row: i + 2, error: 'No identifying field (sr, English Description, or ND Number)' });
          continue;
        }

        await db.product.create({ data: record });
        imported++;
        console.log(`✅ Row ${i + 2}: Imported successfully`, { sr: record.sr, desc: record.englishDescription });
      } catch (err: any) {
        errors++;
        const errorMsg = err?.message || String(err);
        errorDetails.push({ row: i + 2, error: errorMsg });
        console.error(`❌ Row ${i + 2}: Import failed -`, errorMsg);
      }
    }

    console.log(`📊 Import complete: ${imported} imported, ${errors} errors, ${rows.length} total`);

    return NextResponse.json({
      imported,
      errors,
      total: rows.length,
      detectedHeaders,
      columnMapping: Object.fromEntries(
        Object.entries(mappingResult).map(([field, info]) => [field, info.excelKey])
      ),
      unmappedColumns,
      errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 20) : undefined, // Limit error details
    });
  } catch (error: any) {
    console.error('❌ Excel import failed:', error);
    return NextResponse.json({
      error: 'Failed to import Excel file: ' + (error?.message || String(error)),
      imported: 0,
      errors: 0,
      total: 0,
    }, { status: 500 });
  }
}
