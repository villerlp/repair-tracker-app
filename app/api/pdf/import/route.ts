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

    // Enhanced parsing: split into sentences and treat each as potential recommendation
    const recNumRegex = /\b\d{4}-\d{2}-\d{4}\b/
    const candidates: Array<{ title: string; description?: string; recommendation_number?: string }> = []

    // First try paragraph-based approach
    const paragraphs = text.split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean)

    for (const p of paragraphs) {
      const lines = p.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
      if (lines.length === 0) continue

      const first = lines[0]
      const rest = lines.slice(1).join(' ')

      // Check if this is a structured recommendation
      const containsKeyword = /recommend/i.test(p) || /recommendation/i.test(p) || /repair/i.test(p)
      const hasRecNum = recNumRegex.test(p)
      const numberedItem = /^\d+\.|^\([0-9]+\)|^[a-z]\)/.test(first)
      const bulletItem = /^[-•*]\s/.test(first)

      if (containsKeyword || hasRecNum || numberedItem || bulletItem) {
        let title = first.replace(/^[-•*]\s/, '').replace(/^\d+\.\s*/, '').replace(/^\([0-9]+\)\s*/, '').replace(/^[a-z]\)\s*/, '')
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
      } else if (lines.length === 1 && first.length > 20 && first.length < 200) {
        // Single-line sentence that looks like a recommendation
        candidates.push({ title: first, description: undefined })
      }
    }

    // If still no results, try sentence-level splitting
    if (candidates.length === 0) {
      const sentences = text.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 20 && s.length < 300)
      
      for (const sentence of sentences.slice(0, 20)) { // Limit to first 20 sentences
        const recMatch = sentence.match(recNumRegex)
        let cleanSentence = sentence
        let recommendation_number: string | undefined
        
        if (recMatch) {
          recommendation_number = recMatch[0]
          cleanSentence = sentence.replace(recNumRegex, '').trim()
        }
        
        if (cleanSentence.length >= 15) {
          candidates.push({ 
            title: cleanSentence.slice(0, 200), 
            description: cleanSentence.length > 200 ? cleanSentence.slice(200) : undefined,
            recommendation_number 
          })
        }
      }
    }

    // Final fallback
    if (candidates.length === 0) {
      const fallbackTitle = text.split(/\r?\n/).find((l: string) => l.trim().length > 10) || 'Imported from PDF'
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
