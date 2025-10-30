import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get total recommendations
    const { count: total_recommendations, error: totalError } = await supabase
      .from('repair_recommendations')
      .select('*', { count: 'exact', head: true })

    if (totalError) throw totalError

    // Get overdue recommendations (due_date < today and status != completed)
    const today = new Date().toISOString().split('T')[0]
    const { count: overdue_count, error: overdueError } = await supabase
      .from('repair_recommendations')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', today)
      .neq('status', 'completed')

    if (overdueError) throw overdueError

    // Get upcoming recommendations (due within 7 days)
    const weekFromNow = new Date()
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    const weekFromNowStr = weekFromNow.toISOString().split('T')[0]

    const { count: upcoming_count, error: upcomingError } = await supabase
      .from('repair_recommendations')
      .select('*', { count: 'exact', head: true })
      .gte('due_date', today)
      .lte('due_date', weekFromNowStr)
      .neq('status', 'completed')

    if (upcomingError) throw upcomingError

    // Calculate completion rate
    const { count: completed_count, error: completedError } = await supabase
      .from('repair_recommendations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    if (completedError) throw completedError

    const completion_rate = (total_recommendations || 0) > 0
      ? Math.round(((completed_count || 0) / (total_recommendations || 0)) * 100)
      : 0

    return NextResponse.json({
      overdue_count: overdue_count || 0,
      upcoming_count: upcoming_count || 0,
      completion_rate,
      total_recommendations: total_recommendations || 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}