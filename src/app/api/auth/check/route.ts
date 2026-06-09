import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Error checking admin:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ exists: !!(data && data.length > 0) });
  } catch (error) {
    console.error('Error checking admin:', error);
    return NextResponse.json({ error: 'Failed to check admin' }, { status: 500 });
  }
}
