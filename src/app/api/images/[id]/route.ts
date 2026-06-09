import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const image = await db.productImage.findUnique({
      where: { id },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Delete file from disk
    try {
      const filePath = join(process.cwd(), 'upload', 'products', image.imageUrl.split('/').pop() || '');
      await unlink(filePath);
    } catch (e) {
      console.error('Error deleting image file:', e);
    }

    // Delete from database
    await db.productImage.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.isPrimary) {
      const image = await db.productImage.findUnique({ where: { id } });
      if (image) {
        await db.productImage.updateMany({
          where: { productId: image.productId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
    }

    const image = await db.productImage.update({
      where: { id },
      data: {
        ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary }),
        ...(body.displayOrder !== undefined && { displayOrder: body.displayOrder }),
      },
    });

    return NextResponse.json(image);
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 });
  }
}
