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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Received body:', body)

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      title: body.title,
      description: body.description,
      priority: body.priority || 'medium',
      status: body.status || 'pending_approval',
      due_date: body.due_date,
      inspection_date: body.inspection_date,
      inspector: body.inspector || null,
    }

    // Try to add recommendation_number if provided and column exists
    if (body.recommendation_number) {
      // Check if this recommendation number already exists
      const { data: existing, error: checkError } = await supabase
        .from('repair_recommendations')
        .select('id, recommendation_number')
        .eq('recommendation_number', body.recommendation_number)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking for duplicate rec #:', checkError)
      }

      if (existing) {
        return NextResponse.json(
          { error: `Recommendation number ${body.recommendation_number} is already in use. Please use a different number.` },
          { status: 409 }
        )
      }

      insertData.recommendation_number = body.recommendation_number
    }

    console.log('Inserting data:', insertData)

    const { data, error } = await supabase
      .from('repair_recommendations')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('Database insert error:', error)
      // If the error is about recommendation_number column not existing, try without it
      if (error.message.includes('recommendation_number')) {
        console.log('Retrying without recommendation_number...')
        delete insertData.recommendation_number
        const { data: retryData, error: retryError } = await supabase
          .from('repair_recommendations')
          .insert([insertData])
          .select()
          .single()
        
        if (retryError) {
          console.error('Retry failed:', retryError)
          return NextResponse.json({ error: retryError.message }, { status: 500 })
        }
        return NextResponse.json(retryData)
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Successfully inserted:', data)
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('POST /api/recommendations error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}