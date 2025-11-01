import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ 
        error: 'Google Sheets credentials not configured. Please add GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SPREADSHEET_ID to .env.local' 
      }, { status: 500 })
    }

    // Get recommendations from request body
    const { recommendations } = await request.json()

    if (!recommendations || recommendations.length === 0) {
      return NextResponse.json({ error: 'No recommendations to export' }, { status: 400 })
    }

    // Configure Google Sheets API
    // Handle private key - it might be JSON-escaped or already properly formatted
    let formattedPrivateKey = privateKey;
    
    // If the key doesn't contain actual newlines, replace \n with actual newlines
    if (!privateKey.includes('\n') && privateKey.includes('\\n')) {
      formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Validate private key format
    if (!formattedPrivateKey.includes('BEGIN PRIVATE KEY')) {
      return NextResponse.json({ 
        error: 'Invalid private key format. Please ensure you copied the entire private_key value from the JSON file, including the BEGIN and END markers.' 
      }, { status: 500 })
    }
    
    let auth;
    try {
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: formattedPrivateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      })
    } catch (authError: any) {
      console.error('Google Auth error:', authError)
      return NextResponse.json({ 
        error: `Authentication failed: ${authError.message}. Please check your GOOGLE_SHEETS_PRIVATE_KEY format in .env.local` 
      }, { status: 500 })
    }

    const sheets = google.sheets({ version: 'v4', auth })

    try {
      // Check if the sheet exists and get header row
      const sheetResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A1:G1', // Assuming headers are in first row
      })

      const headers = sheetResponse.data.values?.[0] || []
      const expectedHeaders = ['Recommendation Number', 'Priority', 'Title', 'Description', 'Status', 'Inspection Date', 'Due Date']

      // If headers don't exist or are incomplete, add them
      if (headers.length === 0 || !expectedHeaders.every(h => headers.includes(h))) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Sheet1!A1:G1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [expectedHeaders],
          },
        })
      }

      // Prepare data rows
      const values = recommendations.map((rec: any) => [
        rec.recommendation_number || rec.id,
        rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1),
        rec.title,
        rec.description,
        rec.status.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        rec.inspection_date || '',
        rec.due_date || ''
      ])

      // Append data to sheet
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A2:G', // Start from row 2 (after headers)
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      })

      return NextResponse.json({ 
        success: true, 
        message: `Successfully exported ${recommendations.length} recommendations to Google Sheets`,
        rowsAdded: appendResponse.data.updates?.updatedRows || 0
      })
    } catch (sheetsError: any) {
      console.error('Google Sheets API error:', sheetsError)
      
      // Provide specific error messages
      if (sheetsError.code === 403) {
        return NextResponse.json({ 
          error: 'Access denied. Please ensure the spreadsheet is shared with your service account email (Editor permission).' 
        }, { status: 403 })
      }
      
      if (sheetsError.code === 404) {
        return NextResponse.json({ 
          error: 'Spreadsheet not found. Please check your GOOGLE_SPREADSHEET_ID in .env.local' 
        }, { status: 404 })
      }
      
      return NextResponse.json({ 
        error: `Google Sheets API error: ${sheetsError.message}` 
      }, { status: 500 })
    }

  } catch (error: unknown) {
    console.error('Google Sheets export error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
