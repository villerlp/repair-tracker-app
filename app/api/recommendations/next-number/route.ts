import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate recommendation number in format YYYY-MM-0001
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${year}-${month}`

    // Get count of recommendations for current month
    const startOfMonth = `${year}-${month}-01T00:00:00`
    const endOfMonth = new Date(year, now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { count, error: countError } = await supabase
      .from('repair_recommendations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth)

    if (countError) {
      console.error('Error counting recommendations:', countError)
      // If there's an error, default to 0001
      return NextResponse.json({ recommendation_number: `${yearMonth}-0001` })
    }

    const nextNumber = ((count || 0) + 1).toString().padStart(4, '0')
    const recommendationNumber = `${yearMonth}-${nextNumber}`

    return NextResponse.json({ recommendation_number: recommendationNumber })
  } catch (error: unknown) {
    console.error('GET /api/recommendations/next-number error:', error)
    // Fallback to default format
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return NextResponse.json({ recommendation_number: `${year}-${month}-0001` })
  }
}
