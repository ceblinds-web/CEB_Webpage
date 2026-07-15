import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Public counterpart to /api/vendor-catalog (which requires admin and
// returns full pricing). This one strips every price field and only
// returns what the public catalog page needs to group photos by series —
// vendor, category, subcategory, series, and the fabric code list.
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vendor_catalog')
    .select('vendor, product_category, subcategory, series, fabric_codes')
    .eq('is_active', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
