-- ===========================================
-- Product Catalog - Supabase Setup Script
-- ===========================================
-- Run this in Supabase Dashboard → SQL Editor
-- ===========================================

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 3. Allow all operations on admin_users (auth is handled in the app)
CREATE POLICY "Allow all on admin_users" ON admin_users
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Create product-images storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for product-images bucket
-- Allow anyone to read images (public)
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- Allow anyone to upload images (since this is an internal tool)
CREATE POLICY "Allow uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images');

-- Allow anyone to update images
CREATE POLICY "Allow updates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images');

-- Allow anyone to delete images
CREATE POLICY "Allow deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images');

-- 6. Update RLS policies on products table to allow full access
-- (Since this is a single-admin internal tool, we allow all operations)
-- First, drop existing restrictive policies if they exist
-- Then create permissive policies:

-- Allow SELECT (read) for everyone
CREATE POLICY "Allow read products" ON products
  FOR SELECT USING (true);

-- Allow INSERT for everyone
CREATE POLICY "Allow insert products" ON products
  FOR INSERT WITH CHECK (true);

-- Allow UPDATE for everyone
CREATE POLICY "Allow update products" ON products
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow DELETE for everyone
CREATE POLICY "Allow delete products" ON products
  FOR DELETE USING (true);

-- 7. Same for product_images table
CREATE POLICY "Allow read product_images" ON product_images
  FOR SELECT USING (true);

CREATE POLICY "Allow insert product_images" ON product_images
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update product_images" ON product_images
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete product_images" ON product_images
  FOR DELETE USING (true);
