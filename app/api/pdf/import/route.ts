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

    // Enhanced parsing: Look for table with columns: Section (Title), Area/Component, Repair Recommendation Status, Remarks
    const recNumRegex = /\b\d{4}-\d{2}-\d{4}\b/
    type ImportedRec = { 
      title: string; 
      description?: string; 
      recommendation_number?: string;
      area?: string;
      status?: string;
      remarks?: string;
    }
    const candidates: Array<ImportedRec> = []

    // Split text into lines for parsing
    const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
    
    // Try to find table header with column names
    let tableHeaderIndex = -1
    let columnMapping: { section?: number; area?: number; status?: number; remarks?: number } = {}
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const upperLine = line.toUpperCase()
      
      // Look for table header row with column names
      if ((upperLine.includes('SECTION') || upperLine.includes('TITLE')) &&
          (upperLine.includes('AREA') || upperLine.includes('COMPONENT')) &&
          (upperLine.includes('STATUS') || upperLine.includes('RECOMMENDATION'))) {
        tableHeaderIndex = i
        
        // Try to determine column positions (simple approach - look for keywords)
        const words = line.split(/\s{2,}|\t/).map(w => w.trim()).filter(Boolean)
        words.forEach((word, idx) => {
          const upper = word.toUpperCase()
          if (upper.includes('SECTION') || upper.includes('TITLE')) columnMapping.section = idx
          if (upper.includes('AREA') || upper.includes('COMPONENT')) columnMapping.area = idx
          if (upper.includes('STATUS')) columnMapping.status = idx
          if (upper.includes('REMARK')) columnMapping.remarks = idx
        })
        break
      }
    }

    // If we found a table header, parse the table rows
    if (tableHeaderIndex >= 0) {
      console.log('Found table header at line', tableHeaderIndex, 'Column mapping:', columnMapping)
      
      for (let i = tableHeaderIndex + 1; i < lines.length; i++) {
        const line = lines[i]
        
        // Stop at empty lines or new sections
        if (!line || line.length < 5) continue
        if (line === line.toUpperCase() && line.length < 50 && !line.match(/^[-•*○◦▪▫\d]/)) {
          break
        }
        
        // Split by multiple spaces or tabs (common in PDFs)
        const cells = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean)
        
        if (cells.length >= 2) {
          const title = columnMapping.section !== undefined ? cells[columnMapping.section] : cells[0]
          const area = columnMapping.area !== undefined ? cells[columnMapping.area] : cells[1]
          const status = columnMapping.status !== undefined ? cells[columnMapping.status] : (cells[2] || undefined)
          const remarks = columnMapping.remarks !== undefined ? cells[columnMapping.remarks] : (cells[3] || undefined)
          
          let recommendation_number: string | undefined
          const recMatch = line.match(recNumRegex)
          if (recMatch) {
            recommendation_number = recMatch[0]
          }
          
          // Build description from area and remarks
          const descParts = []
          if (area && area !== title) descParts.push(`Area/Component: ${area}`)
          if (remarks) descParts.push(`Remarks: ${remarks}`)
          
          if (title && title.length >= 3) {
            candidates.push({
              title,
              description: descParts.length > 0 ? descParts.join('\n') : undefined,
              recommendation_number,
              area,
              status,
              remarks
            })
          }
        }
      }
    }

    // Fallback 1: Look for "Recommendations" section with bullet points
    if (candidates.length === 0) {
      let inRecommendationsSection = false
      let sectionStartIndex = -1
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const upperLine = line.toUpperCase()
        
        if (
          upperLine.includes('REPAIR RECOMMENDATION') || 
          upperLine === 'RECOMMENDATIONS' ||
          upperLine === 'REPAIR RECOMMENDATIONS'
        ) {
          inRecommendationsSection = true
          sectionStartIndex = i + 1
          break
        }
      }

      if (inRecommendationsSection && sectionStartIndex > 0) {
        for (let i = sectionStartIndex; i < lines.length; i++) {
          const line = lines[i]
          
          if (line.length < 50 && line === line.toUpperCase() && !line.match(/^[-•*○◦▪▫]\s/)) {
            break
          }
          
          const isBullet = /^[-•*○◦▪▫]\s/.test(line)
          const isNumbered = /^\d+\.|^\([0-9]+\)|^[a-z]\)/.test(line)
          
          if (isBullet || isNumbered) {
            let title = line
              .replace(/^[-•*○◦▪▫]\s+/, '')
              .replace(/^\d+\.\s*/, '')
              .replace(/^\([0-9]+\)\s*/, '')
              .replace(/^[a-z]\)\s*/, '')
              .trim()
            
            let recommendation_number: string | undefined
            const recMatch = title.match(recNumRegex)
            if (recMatch) {
              recommendation_number = recMatch[0]
              title = title.replace(recNumRegex, '').trim()
            }
            
            if (title && title.length >= 10) {
              candidates.push({ title, description: undefined, recommendation_number })
            }
          }
        }
      }
    }

    // Fallback 2: Try paragraph-based approach
    if (candidates.length === 0) {
      const paragraphs = text.split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean)

      for (const p of paragraphs) {
        const pLines = p.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
        if (pLines.length === 0) continue

        const first = pLines[0]
        const rest = pLines.slice(1).join(' ')

        const containsKeyword = /recommend/i.test(p) || /repair/i.test(p)
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

    // Map status from PDF to database values
    const mapStatus = (pdfStatus?: string): string => {
      if (!pdfStatus) return 'pending_approval'
      const upper = pdfStatus.toUpperCase()
      if (upper.includes('APPROVE')) return 'approved'
      if (upper.includes('NOT') && upper.includes('APPROVE')) return 'not_approved'
      if (upper.includes('DEFER')) return 'deferred'
      if (upper.includes('TEMPORARY') || upper.includes('TEMP')) return 'temporary_repair'
      if (upper.includes('PENDING')) return 'pending_approval'
      return 'pending_approval' // default
    }

    // Return candidates WITHOUT inserting - let the Add page handle batch insert
    // This ensures each recommendation gets its own unique recommendation number
    const records = candidates.map((c, idx) => ({
      id: `temp-${Date.now()}-${idx}`,
      title: c.title,
      description: c.description || '',
      priority: 'medium',
      status: mapStatus(c.status),
      due_date: null,
      inspection_date: null,
      recommendation_number: c.recommendation_number, // May be undefined, will be generated on insert
    }))

    return NextResponse.json({ success: true, imported: records.length, records })
  } catch (err: unknown) {
    console.error('PDF import error:', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
