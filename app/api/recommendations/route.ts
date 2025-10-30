import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is manager or admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isManager = profile?.role === 'manager' || profile?.role === 'admin'

    let query
    if (isManager) {
      // Use the view for managers to include user_email
      query = supabase
        .from('manager_reports')
        .select('*')
        .order('created_at', { ascending: false })
    } else {
      // Regular users see only their own
      query = supabase
        .from('repair_recommendations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    }

    const { data: recommendations, error } = await query

    if (error) throw error

    return NextResponse.json(recommendations)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const { data, error } = await supabase
      .from('repair_recommendations')
      .insert([{
        user_id: user.id,
        title: body.title,
        description: body.description,
        priority: body.priority || 'medium',
        status: body.status || 'pending',
        due_date: body.due_date,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}