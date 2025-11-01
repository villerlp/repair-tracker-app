import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// Use Node.js runtime for PDF extraction
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Expect raw PDF binary in request body (Content-Type: application/pdf)
    const arrayBuffer = await request.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Use pdf2json which works reliably in Node.js
    const PDFParser = require('pdf2json')
    const pdfParser = new PDFParser()
    
    // Create a promise to handle the parsing
    const parsePromise = new Promise<string>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError))
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // Extract text from all pages
          let text = ''
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R) {
                    for (const run of textItem.R) {
                      if (run.T) {
                        // Decode URI-encoded text
                        text += decodeURIComponent(run.T) + ' '
                      }
                    }
                  }
                }
                text += '\n'
              }
            }
          }
          resolve(text.trim())
        } catch (err) {
          reject(err)
        }
      })
    })
    
    // Parse the PDF buffer
    pdfParser.parseBuffer(buffer)
    const text = await parsePromise

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text could be extracted from the PDF' }, { status: 400 })
    }

    // Enhanced parsing: Look for "Repair Recommendations" or "Recommendations" section with bullet points
    const recNumRegex = /\b\d{4}-\d{2}-\d{4}\b/
    const candidates: Array<{ title: string; description?: string; recommendation_number?: string }> = []

    // Split text into lines for section-based parsing
    const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
    
    // Find the section header (REPAIR RECOMMENDATIONS or RECOMMENDATIONS in bold/caps)
    let inRecommendationsSection = false
    let sectionStartIndex = -1
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const upperLine = line.toUpperCase()
      
      // Check if this line is a "Recommendations" header
      if (
        upperLine.includes('REPAIR RECOMMENDATION') || 
        (upperLine.includes('RECOMMENDATION') && !upperLine.includes('REPAIR')) ||
        upperLine === 'RECOMMENDATIONS' ||
        upperLine === 'REPAIR RECOMMENDATIONS'
      ) {
        inRecommendationsSection = true
        sectionStartIndex = i + 1
        break
      }
    }

    // If we found a recommendations section, extract bullet points from it
    if (inRecommendationsSection && sectionStartIndex > 0) {
      for (let i = sectionStartIndex; i < lines.length; i++) {
        const line = lines[i]
        
        // Stop if we hit another major section header (all caps, short line)
        if (line.length < 50 && line === line.toUpperCase() && !line.match(/^[-•*○◦▪▫]\s/)) {
          break
        }
        
        // Check if this is a bullet point
        const isBullet = /^[-•*○◦▪▫]\s/.test(line)
        const isNumbered = /^\d+\.|^\([0-9]+\)|^[a-z]\)/.test(line)
        
        if (isBullet || isNumbered) {
          // Clean up the bullet/number prefix
          let title = line
            .replace(/^[-•*○◦▪▫]\s+/, '')
            .replace(/^\d+\.\s*/, '')
            .replace(/^\([0-9]+\)\s*/, '')
            .replace(/^[a-z]\)\s*/, '')
            .trim()
          
          let recommendation_number: string | undefined
          
          // Extract recommendation number if present
          const recMatch = title.match(recNumRegex)
          if (recMatch) {
            recommendation_number = recMatch[0]
            title = title.replace(recNumRegex, '').trim()
          }
          
          // Only add if the title is substantial
          if (title && title.length >= 10) {
            candidates.push({ 
              title, 
              description: undefined,
              recommendation_number 
            })
          }
        }
      }
    }

    // Fallback: If no recommendations section found, try the old paragraph-based approach
    if (candidates.length === 0) {
      const paragraphs = text.split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean)

      for (const p of paragraphs) {
        const pLines = p.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
        if (pLines.length === 0) continue

        const first = pLines[0]
        const rest = pLines.slice(1).join(' ')

        // Check if this is a structured recommendation
        const containsKeyword = /recommend/i.test(p) || /recommendation/i.test(p) || /repair/i.test(p)
        const hasRecNum = recNumRegex.test(p)
        const numberedItem = /^\d+\.|^\([0-9]+\)|^[a-z]\)/.test(first)
        const bulletItem = /^[-•*○◦▪▫]\s/.test(first)

        if (containsKeyword || hasRecNum || numberedItem || bulletItem) {
          let title = first
            .replace(/^[-•*○◦▪▫]\s+/, '')
            .replace(/^\d+\.\s*/, '')
            .replace(/^\([0-9]+\)\s*/, '')
            .replace(/^[a-z]\)\s*/, '')
          let recommendation_number: string | undefined

          const recMatch = p.match(recNumRegex)
          if (recMatch) {
            recommendation_number = recMatch[0]
            title = title.replace(recNumRegex, '').trim() || title
          }

          const description = rest || undefined

          if (title && title.length >= 10) {
            candidates.push({ title, description, recommendation_number })
          }
        }
      }
    }

    // Final fallback if still no results
    if (candidates.length === 0) {
      const fallbackTitle = lines.find((l: string) => l.length > 10) || 'Imported from PDF'
      candidates.push({ title: fallbackTitle, description: text.slice(0, 2000) })
    }

    // Insert candidates into Supabase
    const insertPayload = candidates.map(c => ({
      user_id: user.id,
      title: c.title,
      description: c.description || '',
      priority: 'medium',
      status: 'pending_approval',
      due_date: null,
      inspection_date: null,
      recommendation_number: c.recommendation_number,
    }))

    const { data, error } = await supabase
      .from('repair_recommendations')
      .insert(insertPayload)
      .select()

    if (error) {
      console.error('PDF import DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, imported: data?.length || 0, records: data })
  } catch (err: unknown) {
    console.error('PDF import error:', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
