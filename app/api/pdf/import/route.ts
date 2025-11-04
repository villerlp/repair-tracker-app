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

    // Get content type from header or URL
    const contentType = request.headers.get('content-type') || ''
    const url = new URL(request.url)
    const fileType = url.searchParams.get('type') || ''
    
    const arrayBuffer = await request.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let text = ''
    
    // Check if it's an Excel file
    if (contentType.includes('spreadsheet') || contentType.includes('excel') || 
        fileType.includes('xlsx') || fileType.includes('xls')) {
      console.log('Parsing Excel file')
      const XLSX = require('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      
      // Convert to JSON to preserve structure
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      console.log(`Excel has ${jsonData.length} rows`)
      
      // Convert rows to text with newlines to help section detection
      text = jsonData.map((row: any) => {
        return Array.isArray(row) ? row.join(' ') : String(row)
      }).join('\n')
      
      console.log('Excel extracted, text length:', text.length)
      console.log('Excel preview:', text.substring(0, 500))
    } else {
      // Parse as PDF - try multiple parsers
      console.log('Parsing PDF file')
      let parseError: any = null
      
      // Strategy 1: Try unpdf (handles compressed streams well)
      try {
        console.log('Trying unpdf...')
        const { extractText } = require('unpdf')
        const { text: extractedText } = await extractText(buffer)
        
        if (extractedText && extractedText.length > 100) {
          text = extractedText
          console.log(`unpdf extracted text, length: ${text.length}`)
          console.log('Sample:', text.substring(0, 200))
        } else {
          throw new Error('unpdf extracted insufficient text')
        }
      } catch (unpdfError) {
        console.log('unpdf failed:', unpdfError)
        parseError = unpdfError
        
        // Strategy 1b: Try pdf-lib to at least verify structure
        try {
          console.log('Trying pdf-lib...')
          const { PDFDocument } = require('pdf-lib')
          const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
          const pages = pdfDoc.getPages()
          console.log(`pdf-lib loaded: ${pages.length} pages`)
          
          // pdf-lib doesn't extract text directly
          throw new Error('pdf-lib cannot extract text, trying next method')
        } catch (pdfLibError) {
          console.log('pdf-lib failed:', pdfLibError)
        }
      }
      
      // Strategy 2: Aggressive raw text extraction
      try {
        console.log('Trying aggressive text extraction...')
        
        // Try multiple encodings and patterns
        const encodings = ['utf8', 'latin1', 'ascii']
        const allTextBlocks: string[] = []
        
        for (const encoding of encodings) {
          try {
            const rawText = buffer.toString(encoding as BufferEncoding)
            
            // Method 1: Look for text between parentheses (PDF text strings)
            const parenPattern = /\(([^)]{3,}?)\)/g
            let match
            while ((match = parenPattern.exec(rawText)) !== null) {
              const text = match[1]
                .replace(/\\n/g, ' ')
                .replace(/\\r/g, ' ')
                .replace(/\\t/g, ' ')
                .replace(/\\\(/g, '(')
                .replace(/\\\)/g, ')')
                .replace(/\\\\/g, '\\')
                .trim()
              
              // Filter out binary garbage - must have mostly printable ASCII
              const printableRatio = (text.match(/[\x20-\x7E]/g) || []).length / text.length
              const hasLetters = /[a-zA-Z]{2,}/.test(text)
              
              if (text.length > 2 && hasLetters && printableRatio > 0.7) {
                allTextBlocks.push(text)
              }
            }
            
            // Method 2: Look for readable ASCII sequences
            const readablePattern = /([A-Z][a-zA-Z0-9\s\-,.:;()]{10,})/g
            while ((match = readablePattern.exec(rawText)) !== null) {
              const text = match[1].trim()
              if (text.length > 10 && !allTextBlocks.includes(text)) {
                allTextBlocks.push(text)
              }
            }
          } catch (encErr) {
            console.log(`Encoding ${encoding} failed:`, encErr)
          }
        }
        
        // Remove duplicates and join
        const uniqueBlocks = Array.from(new Set(allTextBlocks))
        if (uniqueBlocks.length > 0) {
          text = uniqueBlocks.join(' ')
          console.log(`Aggressive extraction found ${uniqueBlocks.length} text blocks, length: ${text.length}`)
          console.log('Sample text:', text.substring(0, 200))
        } else {
          throw new Error('No readable text found in PDF')
        }
      } catch (rawError) {
        console.log('Aggressive text extraction failed:', rawError)
        
        // Strategy 3: Last resort - try pdf2json even though it might fail
        try {
          console.log('Trying pdf2json as last resort...')
          const PDFParser = require('pdf2json')
          const pdfParser = new PDFParser()
          
          const parsePromise = new Promise<string>((resolve, reject) => {
            pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError))
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
              try {
                let extractedText = ''
                if (pdfData.Pages) {
                  for (const page of pdfData.Pages) {
                    if (page.Texts) {
                      for (const textItem of page.Texts) {
                        if (textItem.R) {
                          for (const run of textItem.R) {
                            if (run.T) {
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
          
          pdfParser.parseBuffer(buffer)
          text = await parsePromise
        } catch (pdf2jsonError) {
          console.log('pdf2json failed:', pdf2jsonError)
          throw new Error(`All PDF parsing methods failed. Last error: ${pdf2jsonError}`)
        }
      }
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text could be extracted from the file' }, { status: 400 })
    }
    
    console.log('Extracted text preview:', text.substring(0, 500))

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
    // Pattern: M35-A or M35 - A or similar variations
    const sectionPattern = /\b(M\d+\s*-\s*[A-Z])\b/gi
    const statusKeywords = ['Pending', 'Complete', 'Completed', 'In-Progress', 'Partial', 'Approved', 'Deferred', 'In Progress']
    const actionVerbs = ['Replace', 'Repair', 'Clean', 'Install', 'Inspect', 'Evaluate', 'Conduct', 'Perform', 'Seal', 'Tighten', 'Vacuum', 'Maintain', 'Winterization', 'Remove', 'Add', 'Check', 'Verify', 'Properly', 'Ensure', 'Fix', 'Update', 'Test', 'Monitor', 'Review']
    
    // Find all section markers and their positions
    const sectionMatches: Array<{ section: string; start: number }> = []
    let match
    sectionPattern.lastIndex = 0 // Reset regex
    while ((match = sectionPattern.exec(text)) !== null) {
      sectionMatches.push({
        section: match[1].replace(/\s+/g, '').toUpperCase(), // Normalize: "M35 - A" -> "M35-A"
        start: match.index
      })
    }
    
    console.log(`Found ${sectionMatches.length} section markers`)
    
    if (sectionMatches.length > 0) {
      console.log('First 10 sections:', sectionMatches.slice(0, 10).map(s => `${s.section}@${s.start}`))
      console.log('Sample section text:', text.substring(sectionMatches[0].start, Math.min(sectionMatches[0].start + 200, text.length)))
    }
    
    // Process each section to extract recommendation
    for (let i = 0; i < sectionMatches.length; i++) {
      const current = sectionMatches[i]
      const next = sectionMatches[i + 1]
      
      // Extract text between this section and the next (or end of document)
      const endPos = next ? next.start : text.length // Use full text if last section
      const sectionText = text.substring(current.start, endPos).trim()
      
      console.log(`Processing section ${i + 1}/${sectionMatches.length}: ${current.section}, text length: ${sectionText.length}`)
      
      // Remove the section marker from the beginning (handle various formats)
      const content = sectionText.replace(/^M\d+\s*-\s*[A-Z]\s*/i, '').trim()
      
      // Skip if content is too short
      if (content.length < 10) {
        console.log(`  -> Skipping: content too short (${content.length} chars)`)
        continue
      }
      
      console.log(`  -> Content preview: ${content.substring(0, 100)}`)
      
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

    console.log(`✅ Returning ${records.length} recommendations`)
    if (records.length > 0) {
      console.log('First 3 titles:', records.slice(0, 3).map(r => r.title))
    }

    return NextResponse.json({ success: true, imported: records.length, records })
  } catch (err: unknown) {
    console.error('PDF import error:', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
