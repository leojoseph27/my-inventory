import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const material = searchParams.get('material') || '';
    const colour = searchParams.get('colour') || '';
    const made = searchParams.get('made') || '';
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};

    if (search) {
      where.OR = [
        { ndNumber: { contains: search } },
        { barcode: { contains: search } },
        { englishDescription: { contains: search } },
        { arabicDescription: { contains: search } },
        { materials: { contains: search } },
        { colours: { contains: search } },
      ];
    }

    if (material) {
      where.materials = { contains: material };
    }

    if (colour) {
      where.colours = { contains: colour };
    }

    if (made) {
      where.made = { contains: made };
    }

    if (priceMin || priceMax) {
      where.price = {};
      if (priceMin) where.price.gte = parseFloat(priceMin);
      if (priceMax) where.price.lte = parseFloat(priceMax);
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { images: { orderBy: { displayOrder: 'asc' } } },
        orderBy: { sr: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({ products, total, page, limit });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const product = await db.product.create({
      data: {
        sr: body.sr ?? null,
        englishDescription: body.englishDescription || null,
        arabicDescription: body.arabicDescription || null,
        ndNumber: body.ndNumber || null,
        barcode: body.barcode || null,
        colours: body.colours ? JSON.stringify(body.colours) : null,
        length: body.length ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        made: body.made || null,
        materials: body.materials ? JSON.stringify(body.materials) : null,
        additionalInfo: body.additionalInfo ? JSON.stringify(body.additionalInfo) : null,
        price: body.price ?? null,
        pcs: body.pcs ?? null,
      },
      include: { images: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
