import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: { images: { orderBy: { displayOrder: 'asc' } } },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const product = await db.product.update({
      where: { id },
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
      include: { images: { orderBy: { displayOrder: 'asc' } } },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get product images to delete files
    const product = await db.product.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Delete image files
    for (const image of product.images) {
      try {
        const filePath = join(process.cwd(), 'upload', 'products', image.imageUrl.split('/').pop() || '');
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch (e) {
        console.error('Error deleting image file:', e);
      }
    }

    // Delete product (cascades to images)
    await db.product.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
