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
    // Expected columns: Section, Area/Component, Repair Recommendation, Status, Remarks
    let tableHeaderIndex = -1
    let columnMapping: { section?: number; area?: number; repairRec?: number; status?: number; remarks?: number } = {}
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const upperLine = line.toUpperCase()
      
      // Look for table header row - must have Section, Area/Component, and either Repair Recommendation or Status
      if (upperLine.includes('SECTION') &&
          (upperLine.includes('AREA') || upperLine.includes('COMPONENT')) &&
          (upperLine.includes('REPAIR') || upperLine.includes('RECOMMENDATION'))) {
        tableHeaderIndex = i
        
        // Try to determine column positions by splitting on multiple spaces or tabs
        const words = line.split(/\s{2,}|\t/).map(w => w.trim()).filter(Boolean)
        console.log('Header columns found:', words)
        
        words.forEach((word, idx) => {
          const upper = word.toUpperCase()
          if (upper.includes('SECTION') && !upper.includes('REPAIR')) columnMapping.section = idx
          if (upper.includes('AREA') || upper.includes('COMPONENT')) columnMapping.area = idx
          if (upper.includes('REPAIR') && upper.includes('RECOMMENDATION')) columnMapping.repairRec = idx
          if (upper === 'STATUS' || (upper.includes('STATUS') && !upper.includes('REPAIR'))) columnMapping.status = idx
          if (upper.includes('REMARK')) columnMapping.remarks = idx
        })
        
        console.log('Column mapping:', columnMapping)
        break
      }
    }

    // If we found a table header, parse the table rows
    if (tableHeaderIndex >= 0) {
      console.log('Found table header at line', tableHeaderIndex, 'Column mapping:', columnMapping)
      
      // Status keywords to help identify status column
      const statusKeywords = ['Pending', 'Complete', 'In-Progress', 'Partial', 'Approved', 'Deferred']
      
      for (let i = tableHeaderIndex + 1; i < lines.length; i++) {
        const line = lines[i]
        
        // Stop at empty lines or new major sections
        if (!line || line.length < 5) continue
        if (line === line.toUpperCase() && line.length < 50 && !line.match(/^[M\d-]/)) {
          break
        }
        
        // Parse table row: Section Area/Component Repair-Recommendation Status Remarks
        // Section pattern: M35-A or similar
        const sectionMatch = line.match(/^(M\d+-[A-Z])\s+/)
        if (!sectionMatch) continue
        
        const section = sectionMatch[1]
        let remainingText = line.substring(sectionMatch[0].length).trim()
        
        // Extract status (look for status keywords from the end)
        let status = 'pending_approval'
        let statusText = ''
        for (const keyword of statusKeywords) {
          const statusRegex = new RegExp(`\\b${keyword}\\b(?:\\s+.*)?$`, 'i')
          const match = remainingText.match(statusRegex)
          if (match) {
            statusText = match[0].trim()
            remainingText = remainingText.substring(0, match.index).trim()
            status = keyword
            break
          }
        }
        
        // Now we have: Area/Component + Repair Recommendation + maybe Remarks
        // Look for the first capital letter or long phrase as area
        // The repair recommendation usually starts with a verb (Replace, Repair, Clean, etc.)
        const actionVerbs = ['Replace', 'Repair', 'Clean', 'Install', 'Inspect', 'Evaluate', 'Conduct', 'Perform', 'Seal', 'Tighten', 'Vacuum', 'Maintain', 'Winterization']
        
        let area = ''
        let repairRec = ''
        let remarks = ''
        
        // Find where the repair recommendation starts (action verb)
        let repairStartIndex = -1
        for (const verb of actionVerbs) {
          const verbIndex = remainingText.indexOf(verb)
          if (verbIndex > 0) {
            repairStartIndex = verbIndex
            area = remainingText.substring(0, verbIndex).trim()
            repairRec = remainingText.substring(verbIndex).trim()
            break
          }
        }
        
        // If no action verb found, assume first part is area, rest is repair rec
        if (repairStartIndex === -1) {
          const parts = remainingText.split(/\s{2,}/)
          if (parts.length >= 2) {
            area = parts[0]
            repairRec = parts.slice(1).join(' ')
          } else {
            repairRec = remainingText
          }
        }
        
        // Extract recommendation number if present
        let recommendation_number: string | undefined
        const recMatch = line.match(recNumRegex)
        if (recMatch) {
          recommendation_number = recMatch[0]
        }
        
        // Extract title: Use first 3-4 words from Repair Recommendation
        let title = ''
        if (repairRec) {
          const words = repairRec.split(/\s+/)
          const titleWords = []
          for (let j = 0; j < Math.min(4, words.length); j++) {
            if (titleWords.join(' ').length + words[j].length > 60) break
            titleWords.push(words[j])
          }
          title = titleWords.join(' ')
        }
        
        // Fallback to section if no good title
        if (!title || title.length < 3) {
          title = `${section} - ${area || 'Recommendation'}`.substring(0, 60)
        }
        
        // Build description
        const descParts = []
        descParts.push(`Section: ${section}`)
        if (area) descParts.push(`Area/Component: ${area}`)
        if (repairRec) descParts.push(`Repair Recommendation: ${repairRec}`)
        if (statusText && statusText !== status) descParts.push(`Status: ${statusText}`)
        if (remarks) descParts.push(`Remarks: ${remarks}`)
        
        candidates.push({
          title,
          description: descParts.join('\n'),
          recommendation_number,
          area,
          status: statusText.toLowerCase().replace(/[-\s]/g, '_') || 'pending_approval',
          remarks
        })
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
