# Repair Tracker App

A web application to track repair recommendations, built with React, Next.js, Supabase, and Vercel.

## Features

- User authentication (login/sign-up)
- Add repair recommendations
- Dashboard with charts for data visualization
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

   - Create tables for users, repair recommendations, etc. (refer to Supabase dashboard)

5. Run the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

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
