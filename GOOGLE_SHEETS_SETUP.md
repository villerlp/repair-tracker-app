# Google Sheets Integration Setup Guide

This guide will help you set up the Google Sheets integration for the Repair Tracker app, allowing you to export repair recommendations directly to a Google Spreadsheet.

## Prerequisites

- A Google account (free)
- Access to Google Cloud Console
- The Repair Tracker app installed and running

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top and select **"New Project"**
3. Enter a project name (e.g., "Repair Tracker Integration")
4. Click **"Create"**
5. Wait for the project to be created and make sure it's selected

## Step 2: Enable Google Sheets API

1. In the Google Cloud Console, go to **"APIs & Services"** > **"Library"**
2. Search for **"Google Sheets API"**
3. Click on it and press **"Enable"**
4. Wait for the API to be enabled

## Step 3: Create a Service Account

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"** > **"Service Account"**
3. Enter a service account name (e.g., "repair-tracker-sheets")
4. Click **"Create and Continue"**
5. Skip the optional steps by clicking **"Continue"** and then **"Done"**

## Step 4: Generate Service Account Key

1. In the **"Credentials"** page, find your newly created service account
2. Click on the service account email
3. Go to the **"Keys"** tab
4. Click **"Add Key"** > **"Create new key"**
5. Choose **JSON** format
6. Click **"Create"**
7. A JSON file will be downloaded to your computer - **keep this file secure!**

## Step 5: Extract Credentials from JSON File

Open the downloaded JSON file. You'll need two values:

1. **client_email**: This looks like `repair-tracker-sheets@project-name.iam.gserviceaccount.com`
2. **private_key**: This is a long string that starts with `-----BEGIN PRIVATE KEY-----`

## Step 6: Create a Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com/)
2. Click **"Blank"** to create a new spreadsheet
3. Name your spreadsheet (e.g., "Repair Tracker Data")
4. Copy the **Spreadsheet ID** from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
   - The ID is the long string between `/d/` and `/edit`

## Step 7: Share the Spreadsheet with Service Account

1. In your Google Spreadsheet, click the **"Share"** button (top right)
2. Paste the **client_email** from Step 5 (the service account email)
3. Make sure the permission is set to **"Editor"**
4. **Uncheck** "Notify people" (the service account doesn't need an email)
5. Click **"Share"**

## Step 8: Configure Environment Variables

1. Open your `.env.local` file in the repair-tracker-app directory
2. Add the following variables:

```env
# Google Sheets Integration
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=your_google_spreadsheet_id_here
```

**Important Notes for Private Key:**
- Open your downloaded JSON file in a text editor
- Copy the ENTIRE `private_key` value (it's a long string that starts with `-----BEGIN PRIVATE KEY-----` and ends with `-----END PRIVATE KEY-----\n`)
- The key should look like this in the JSON file:
  ```json
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhk...(lots of characters)...xyz\n-----END PRIVATE KEY-----\n"
  ```
- Copy everything between the quotes (including `\n` characters)
- Paste it into your `.env.local` file with quotes around it
- Do NOT modify the `\n` characters - keep them as `\n` (not actual line breaks)

**Other Notes:**
- Replace `your_service_account_email@your-project.iam.gserviceaccount.com` with the actual `client_email` from your JSON file
- Replace `your_google_spreadsheet_id_here` with the actual ID from Step 6

## Step 9: Restart Your Application

1. Stop your development server (Ctrl+C in the terminal)
2. Restart it with:
   ```bash
   npm run dev
   ```

## Step 10: Test the Integration

1. Open your Repair Tracker app in the browser
2. Go to the Dashboard
3. Click the **"Export to Google Sheets"** button
4. Check your Google Spreadsheet - you should see the data appear!

## Spreadsheet Structure

The integration will automatically create headers if they don't exist:

- **Column A**: Recommendation Number
- **Column B**: Priority
- **Column C**: Title
- **Column D**: Description
- **Column E**: Status
- **Column F**: Inspection Date
- **Column G**: Due Date

## Troubleshooting

### Error: "Google Sheets credentials not configured"

**Solution:** Make sure all three environment variables are set in `.env.local` and restart your dev server.

### Error: "Unauthorized" or "403 Forbidden"

**Solution:** 
1. Verify the spreadsheet is shared with the service account email
2. Check that the service account has "Editor" permissions
3. Make sure the Spreadsheet ID is correct

### Error: "Invalid private key" or "error:1E08010C:DECODER routines::unsupported"

This error means the private key format is incorrect.

**Solution:**
1. Open your downloaded JSON file in a text editor (Notepad, VS Code, etc.)
2. Find the `"private_key"` field - it should look like:
   ```json
   "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqh...\n-----END PRIVATE KEY-----\n"
   ```
3. Copy EVERYTHING between the quotes (the entire value including `\n` characters)
4. In your `.env.local`, paste it like this:
   ```env
   GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqh...\n-----END PRIVATE KEY-----\n"
   ```
5. **Do NOT** replace `\n` with actual line breaks - keep them as the literal characters `\n`
6. Make sure there are quotes around the entire value
7. Restart your dev server after updating

### Error: "API not enabled"

**Solution:** Go back to Google Cloud Console and make sure the Google Sheets API is enabled for your project.

### Data not appearing in the spreadsheet

**Solution:**
1. Check the browser console for errors
2. Verify the Spreadsheet ID is correct
3. Make sure you're looking at "Sheet1" (the default sheet name)
4. Try refreshing the Google Spreadsheet page

## Security Best Practices

1. **Never commit `.env.local` to version control** - it's already in `.gitignore`
2. **Keep your service account JSON file secure** - don't share it publicly
3. **Rotate keys periodically** - you can create new keys in Google Cloud Console
4. **Use least privilege** - the service account only needs access to the specific spreadsheet
5. **Monitor usage** - check Google Cloud Console for unusual API activity

## Additional Resources

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Account Authentication](https://cloud.google.com/docs/authentication/production)
- [Google Cloud Console](https://console.cloud.google.com/)

## Support

If you encounter issues not covered in this guide:

1. Check the application logs in your terminal
2. Verify all environment variables are set correctly
3. Ensure the Google Sheets API is enabled
4. Confirm the service account has access to the spreadsheet

---

**Note:** The Google Sheets API has generous free tier limits. For normal usage (occasional exports), you won't hit any limits. If you need to export thousands of rows frequently, review the [Google Sheets API usage limits](https://developers.google.com/sheets/api/limits).
