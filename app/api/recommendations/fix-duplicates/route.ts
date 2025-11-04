import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Checking for duplicate recommendation numbers...')

    // Get all user's recommendations ordered by created_at
    const { data: allRecs, error: fetchError } = await supabase
      .from('repair_recommendations')
      .select('id, recommendation_number, created_at, title')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch recommendations', details: fetchError }, { status: 500 })
    }

    if (!allRecs || allRecs.length === 0) {
      return NextResponse.json({ 
        message: 'No recommendations found',
        statistics: {
          total: 0,
          empty: 0,
          duplicates: 0,
          fixed: 0
        }
      })
    }

    // Find duplicates and empty numbers
    const numberMap = new Map<string, string[]>()
    const emptyNumbers: string[] = []

    for (const rec of allRecs) {
      if (!rec.recommendation_number || rec.recommendation_number.trim() === '') {
        emptyNumbers.push(rec.id)
      } else {
        const existing = numberMap.get(rec.recommendation_number) || []
        existing.push(rec.id)
        numberMap.set(rec.recommendation_number, existing)
      }
    }

    const duplicates = Array.from(numberMap.entries()).filter(([_, ids]) => ids.length > 1)
    const needsFix = duplicates.reduce((sum, [_, ids]) => sum + ids.length - 1, 0) + emptyNumbers.length

    console.log(`📊 Found: ${duplicates.length} duplicates, ${emptyNumbers.length} empty numbers`)

    if (needsFix === 0) {
      return NextResponse.json({
        message: 'No duplicates or empty numbers found',
        statistics: {
          total: allRecs.length,
          empty: 0,
          duplicates: 0,
          fixed: 0
        }
      })
    }

    // Get current year-month and find highest number
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${year}-${month}`

    const { data: highestRec } = await supabase
      .from('repair_recommendations')
      .select('recommendation_number')
      .eq('user_id', user.id)
      .like('recommendation_number', `${yearMonth}-%`)
      .order('recommendation_number', { ascending: false })
      .limit(1)

    let nextNumber = 1
    if (highestRec && highestRec.length > 0) {
      const match = highestRec[0].recommendation_number?.match(/-(\d{4})$/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    console.log(`🔧 Starting fixes from ${yearMonth}-${nextNumber.toString().padStart(4, '0')}`)

    let fixedCount = 0
    const updates: Array<{ id: string; oldNumber: string; newNumber: string; title: string }> = []

    // Fix duplicates - keep first (oldest), renumber rest
    for (const [dupNumber, ids] of duplicates) {
      for (let i = 1; i < ids.length; i++) {
        const newNumber = `${yearMonth}-${nextNumber.toString().padStart(4, '0')}`
        const rec = allRecs.find(r => r.id === ids[i])

        const { error: updateError } = await supabase
          .from('repair_recommendations')
          .update({ recommendation_number: newNumber })
          .eq('id', ids[i])
          .eq('user_id', user.id)

        if (!updateError) {
          fixedCount++
          updates.push({
            id: ids[i],
            oldNumber: dupNumber,
            newNumber: newNumber,
            title: rec?.title || 'Unknown'
          })
          nextNumber++
        }
      }
    }

    // Fix empty numbers
    for (const id of emptyNumbers) {
      const newNumber = `${yearMonth}-${nextNumber.toString().padStart(4, '0')}`
      const rec = allRecs.find(r => r.id === id)

      const { error: updateError } = await supabase
        .from('repair_recommendations')
        .update({ recommendation_number: newNumber })
        .eq('id', id)
        .eq('user_id', user.id)

      if (!updateError) {
        fixedCount++
        updates.push({
          id: id,
          oldNumber: '(empty)',
          newNumber: newNumber,
          title: rec?.title || 'Unknown'
        })
        nextNumber++
      }
    }

    return NextResponse.json({
      message: `Fixed ${fixedCount} recommendation numbers`,
      statistics: {
        total: allRecs.length,
        empty: emptyNumbers.length,
        duplicates: duplicates.length,
        fixed: fixedCount
      },
      updates: updates,
      nextAvailable: `${yearMonth}-${nextNumber.toString().padStart(4, '0')}`
    })

  } catch (error: unknown) {
    console.error('POST /api/recommendations/fix-duplicates error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
