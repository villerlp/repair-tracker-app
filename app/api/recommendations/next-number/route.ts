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
    // The last 4 digits are continuous across all months
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${year}-${month}`

    // Find the highest existing number across ALL recommendations (not just current month)
    const { data, error: queryError } = await supabase
      .from('repair_recommendations')
      .select('recommendation_number')
      .not('recommendation_number', 'is', null)
      .order('recommendation_number', { ascending: false })
      .limit(1)

    let nextNumber = 1

    if (!queryError && data && data.length > 0) {
      // Extract the sequence number from the last recommendation (format: YYYY-MM-####)
      const lastNumber = data[0].recommendation_number
      const match = lastNumber?.match(/-(\d{4})$/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    const recommendationNumber = `${yearMonth}-${nextNumber.toString().padStart(4, '0')}`

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
