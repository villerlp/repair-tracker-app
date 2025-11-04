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

    // Try pdf-parse first (more robust), fallback to pdf2json
    let text = ''
    
    try {
      // Try pdf-parse first
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      text = data.text
      console.log('Successfully parsed with pdf-parse')
    } catch (parseError) {
      console.log('pdf-parse failed, trying pdf2json:', parseError)
      
      // Fallback to pdf2json
      const PDFParser = require('pdf2json')
      const pdfParser = new PDFParser()
      
      // Create a promise to handle the parsing
      const parsePromise = new Promise<string>((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError))
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          try {
            // Extract text from all pages
            let extractedText = ''
            if (pdfData.Pages) {
              for (const page of pdfData.Pages) {
                if (page.Texts) {
                  for (const textItem of page.Texts) {
                    if (textItem.R) {
                      for (const run of textItem.R) {
                        if (run.T) {
                          // Decode URI-encoded text
                          extractedText += decodeURIComponent(run.T) + ' '
                        }
                      }
                    }
                  }
                  extractedText += '\n'
                }
              }
            }
            resolve(extractedText.trim())
          } catch (err) {
            reject(err)
          }
        })
      })
      
      // Parse the PDF buffer
      pdfParser.parseBuffer(buffer)
      text = await parsePromise
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text could be extracted from the PDF' }, { status: 400 })
    }

    // Enhanced parsing: Look for M35-A style section markers in the concatenated text
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

    // Parse M35 format: Look for section markers (M35-A, M35-B, etc.) in the text
    // Pattern: M35-A Area/Component Action-words Status
    const sectionPattern = /\b(M\d+-[A-Z])\s+/g
    const statusKeywords = ['Pending', 'Complete', 'In-Progress', 'Partial', 'Approved', 'Deferred', 'In Progress']
    const actionVerbs = ['Replace', 'Repair', 'Clean', 'Install', 'Inspect', 'Evaluate', 'Conduct', 'Perform', 'Seal', 'Tighten', 'Vacuum', 'Maintain', 'Winterization', 'Remove', 'Add', 'Check', 'Verify', 'Properly', 'Ensure']
    
    // Find all section markers and their positions
    const sectionMatches: Array<{ section: string; start: number }> = []
    let match
    while ((match = sectionPattern.exec(text)) !== null) {
      sectionMatches.push({
        section: match[1],
        start: match.index
      })
    }
    
    console.log(`Found ${sectionMatches.length} section markers`)
    
    // Process each section to extract recommendation
    for (let i = 0; i < sectionMatches.length; i++) {
      const current = sectionMatches[i]
      const next = sectionMatches[i + 1]
      
      // Extract text between this section and the next (or end of document)
      const endPos = next ? next.start : text.length
      const sectionText = text.substring(current.start, endPos).trim()
      
      // Remove the section marker from the beginning
      const content = sectionText.replace(/^M\d+-[A-Z]\s+/, '').trim()
      
      // Skip if content is too short
      if (content.length < 10) continue
      
      // Find status keyword at the end
      let statusText = ''
      let status = 'pending_approval'
      let mainContent = content
      
      for (const keyword of statusKeywords) {
        const statusRegex = new RegExp(`\\b${keyword}\\b(?:\\s+.*)?$`, 'i')
        const statusMatch = content.match(statusRegex)
        if (statusMatch) {
          statusText = statusMatch[0].trim()
          mainContent = content.substring(0, statusMatch.index).trim()
          status = keyword.toLowerCase().replace(/[-\s]/g, '_')
          break
        }
      }
      
      // Try to split into Area/Component and Repair Recommendation
      let area = ''
      let repairRec = mainContent
      
      // Find the first action verb
      for (const verb of actionVerbs) {
        const verbRegex = new RegExp(`\\b${verb}\\b`, 'i')
        const verbMatch = mainContent.match(verbRegex)
        if (verbMatch && verbMatch.index && verbMatch.index > 0) {
          area = mainContent.substring(0, verbMatch.index).trim()
          repairRec = mainContent.substring(verbMatch.index).trim()
          break
        }
      }
      
      // Create title from first few words of repair recommendation or area
      let title = ''
      if (repairRec) {
        const words = repairRec.split(/\s+/).slice(0, 5)
        title = words.join(' ')
        if (title.length > 60) {
          title = title.substring(0, 57) + '...'
        }
      } else if (area) {
        title = area.substring(0, 60)
      }
      
      // Fallback title
      if (!title || title.length < 3) {
        title = `${current.section} Recommendation`
      }
      
      // Build description
      const descParts = []
      descParts.push(`Section: ${current.section}`)
      if (area && area !== title) descParts.push(`Area/Component: ${area}`)
      if (repairRec) descParts.push(`Repair Recommendation: ${repairRec}`)
      if (statusText) descParts.push(`Status: ${statusText}`)
      
      // Look for recommendation number
      let recommendation_number: string | undefined
      const recMatch = sectionText.match(recNumRegex)
      if (recMatch) {
        recommendation_number = recMatch[0]
      }
      
      candidates.push({
        title,
        description: descParts.join('\n'),
        recommendation_number,
        area,
        status,
        remarks: ''
      })
    }

    // Fallback 1: Look for "Recommendations" section with bullet points
    if (candidates.length === 0) {
      const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
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
      const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
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
