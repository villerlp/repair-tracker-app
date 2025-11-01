import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is manager or admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .single()

    if (profileError || !profile || !['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get all recommendations with user info
    const { data: recommendations, error } = await supabase
      .from('repair_recommendations')
      .select(`
        *,
        user_profiles!inner(role),
        auth.users!inner(email)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform the data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformed = recommendations.map((rec: Record<string, any>) => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      status: rec.status,
      due_date: rec.due_date,
      created_at: rec.created_at,
      user_email: rec['auth.users']?.email,
      user_role: rec.user_profiles?.role,
    }))

    return NextResponse.json(transformed)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}