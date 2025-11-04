/**
 * Script to find and fix duplicate recommendation numbers
 * Run this with: npx tsx scripts/fix-duplicate-rec-numbers.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}

if (!supabaseServiceKey) {
  console.error('⚠️  Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  console.error('   This script requires the service role key to access all recommendations.')
  console.error('   Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file.')
  console.error('   You can find it in your Supabase project settings under API.')
  process.exit(1)
}

// Use service role key to bypass RLS and access all recommendations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixDuplicateRecNumbers() {
  console.log('🔍 Checking for duplicate recommendation numbers...\n')

  // Get all recommendations ordered by created_at
  const { data: allRecs, error: fetchError } = await supabase
    .from('repair_recommendations')
    .select('id, recommendation_number, created_at, title')
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('Error fetching recommendations:', fetchError)
    return
  }

  if (!allRecs || allRecs.length === 0) {
    console.log('No recommendations found.')
    return
  }

  // Find duplicates
  const numberMap = new Map<string, string[]>() // rec_number -> [id1, id2, ...]
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

  // Find which numbers are duplicated
  const duplicates = Array.from(numberMap.entries()).filter(([_, ids]) => ids.length > 1)

  console.log(`📊 Statistics:`)
  console.log(`   Total recommendations: ${allRecs.length}`)
  console.log(`   Empty numbers: ${emptyNumbers.length}`)
  console.log(`   Duplicate numbers: ${duplicates.length}`)
  console.log(`   Records needing fix: ${duplicates.reduce((sum, [_, ids]) => sum + ids.length - 1, 0) + emptyNumbers.length}\n`)

  if (duplicates.length === 0 && emptyNumbers.length === 0) {
    console.log('✅ No duplicates or empty numbers found!')
    return
  }

  // Get the current year-month pattern
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const yearMonth = `${year}-${month}`

  // Find the highest existing number across ALL recommendations (continuous numbering)
  const { data: highestRec } = await supabase
    .from('repair_recommendations')
    .select('recommendation_number')
    .not('recommendation_number', 'is', null)
    .order('recommendation_number', { ascending: false })
    .limit(1)

  let nextNumber = 1
  if (highestRec && highestRec.length > 0) {
    const match = highestRec[0].recommendation_number?.match(/-(\d{4})$/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  console.log(`🔧 Starting fixes from ${yearMonth}-${nextNumber.toString().padStart(4, '0')}...\n`)

  let fixedCount = 0

  // Fix duplicates - keep the first (oldest) one, renumber the rest
  for (const [dupNumber, ids] of duplicates) {
    console.log(`🔄 Duplicate "${dupNumber}" found in ${ids.length} records`)
    
    // Keep the first one (oldest), fix the rest
    for (let i = 1; i < ids.length; i++) {
      const newNumber = `${yearMonth}-${nextNumber.toString().padStart(4, '0')}`
      const rec = allRecs.find(r => r.id === ids[i])
      
      console.log(`   Updating ${rec?.title?.substring(0, 40)}... from "${dupNumber}" to "${newNumber}"`)
      
      const { error: updateError } = await supabase
        .from('repair_recommendations')
        .update({ recommendation_number: newNumber })
        .eq('id', ids[i])

      if (updateError) {
        console.error(`   ❌ Error updating ${ids[i]}:`, updateError.message)
      } else {
        fixedCount++
        nextNumber++
      }
    }
  }

  // Fix empty numbers
  if (emptyNumbers.length > 0) {
    console.log(`\n🔄 Fixing ${emptyNumbers.length} recommendations with empty numbers`)
    
    for (const id of emptyNumbers) {
      const newNumber = `${yearMonth}-${nextNumber.toString().padStart(4, '0')}`
      const rec = allRecs.find(r => r.id === id)
      
      console.log(`   Assigning "${newNumber}" to ${rec?.title?.substring(0, 40)}...`)
      
      const { error: updateError } = await supabase
        .from('repair_recommendations')
        .update({ recommendation_number: newNumber })
        .eq('id', id)

      if (updateError) {
        console.error(`   ❌ Error updating ${id}:`, updateError.message)
      } else {
        fixedCount++
        nextNumber++
      }
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} recommendation numbers!`)
  console.log(`📌 Next available number: ${yearMonth}-${nextNumber.toString().padStart(4, '0')}`)
}

// Run the fix
fixDuplicateRecNumbers()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
