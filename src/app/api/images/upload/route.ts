import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const productId = formData.get('productId') as string;
    const isPrimary = formData.get('isPrimary') === 'true';

    if (!file || !productId) {
      return NextResponse.json({ error: 'File and productId are required' }, { status: 400 });
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'upload', 'products');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name) || '.jpg';
    const filename = `${productId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Get current max display order
    const existingImages = await db.productImage.findMany({
      where: { productId },
      orderBy: { displayOrder: 'desc' },
      take: 1,
    });
    const nextOrder = existingImages.length > 0 ? existingImages[0].displayOrder + 1 : 0;

    // If this is primary, unset other primaries
    if (isPrimary) {
      await db.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Create image record
    const imageUrl = `/upload/products/${filename}`;
    const image = await db.productImage.create({
      data: {
        productId,
        imageUrl,
        displayOrder: nextOrder,
        isPrimary: isPrimary || nextOrder === 0,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
