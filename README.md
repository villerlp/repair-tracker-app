# Repair Tracker App

A web application to track repair recommendations, built with React, Next.js, Supabase, and Vercel.

## Features

- User authentication (login/sign-up)
- Add repair recommendations with inspection dates
- Dashboard with charts for data visualization
- Export recommendations to Excel, PDF, and Google Sheets
- Reports for managers
- Deployed on Vercel

## Getting Started

### Prerequisites

- Node.js (version 18 or later)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd repair-tracker-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up Supabase:

   - Create a new project on [Supabase](https://supabase.com)
   - Get your project URL and anon key
   - Update `.env.local` with your Supabase credentials:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. Set up the database:

   - Run the SQL script in `supabase-schema.sql` in your Supabase SQL Editor
   - This creates the necessary tables and policies

5. (Optional) Set up Google Sheets integration:

   - Follow the detailed guide in `GOOGLE_SHEETS_SETUP.md`
   - This allows exporting recommendations directly to Google Sheets

6. Run the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

Deploy to Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Technologies Used

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- Recharts
- Vercel

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
