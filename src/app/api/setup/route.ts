import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

/**
 * POST /api/setup
 * Creates the admin_users table and product-images storage bucket.
 * Run this once after deploying the application.
 */
export async function POST() {
  const supabase = createAdminClient();
  const results: { step: string; status: string; message?: string }[] = [];

  // Step 1: Try to create admin_users table via insert (will fail if table doesn't exist)
  // We can't run raw SQL from the client, so we check if the table exists
  const { error: adminCheckError } = await supabase
    .from('admin_users')
    .select('id')
    .limit(1);

  if (adminCheckError) {
    results.push({
      step: 'admin_users table',
      status: 'missing',
      message: `Table does not exist. Please create it in Supabase SQL Editor using the SQL from the setup guide. Error: ${adminCheckError.message}`,
    });
  } else {
    results.push({ step: 'admin_users table', status: 'ok' });
  }

  // Step 2: Check/create product-images storage bucket
  const { data: buckets } = await supabase.storage.listBuckets();
  const productImagesBucket = buckets?.find(b => b.name === 'product-images');

  if (!productImagesBucket) {
    const { error: bucketError } = await supabase.storage.createBucket('product-images', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    });

    if (bucketError) {
      results.push({
        step: 'product-images bucket',
        status: 'warning',
        message: bucketError.message,
      });
    } else {
      results.push({ step: 'product-images bucket', status: 'created' });
    }
  } else {
    results.push({ step: 'product-images bucket', status: 'ok' });
  }

  // Step 3: Verify products table
  const { error: productsError } = await supabase.from('products').select('id').limit(1);
  results.push({
    step: 'products table',
    status: productsError ? 'error' : 'ok',
    message: productsError?.message,
  });

  // Step 4: Verify product_images table
  const { error: imagesError } = await supabase.from('product_images').select('id').limit(1);
  results.push({
    step: 'product_images table',
    status: imagesError ? 'error' : 'ok',
    message: imagesError?.message,
  });

  return NextResponse.json({ results });
}
