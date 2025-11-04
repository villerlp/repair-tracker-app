-- Create repair_recommendations table
CREATE TABLE repair_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_number TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('approved', 'not_approved', 'pending_approval', 'deferred', 'temporary_repair')) DEFAULT 'pending_approval',
  due_date DATE,
  inspection_date DATE,
  inspector_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_repair_recommendations_user_id ON repair_recommendations(user_id);
CREATE INDEX idx_repair_recommendations_status ON repair_recommendations(status);
CREATE INDEX idx_repair_recommendations_due_date ON repair_recommendations(due_date);

-- Enable Row Level Security
ALTER TABLE repair_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can only see their own recommendations
CREATE POLICY "Users can view own recommendations" ON repair_recommendations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own recommendations
CREATE POLICY "Users can insert own recommendations" ON repair_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own recommendations
CREATE POLICY "Users can update own recommendations" ON repair_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own recommendations
CREATE POLICY "Users can delete own recommendations" ON repair_recommendations
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create user_profiles table for roles
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT CHECK (role IN ('user', 'manager', 'admin')) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update repair_recommendations policies for managers
-- Managers can see all recommendations
DROP POLICY "Users can view own recommendations" ON repair_recommendations;
CREATE POLICY "Users can view own or all if manager" ON repair_recommendations
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('manager', 'admin')
    )
  );

-- Create a view for manager reports
CREATE VIEW manager_reports AS
SELECT
  rr.*,
  up.role as user_role,
  au.email as user_email
FROM repair_recommendations rr
JOIN user_profiles up ON rr.user_id = up.id
JOIN auth.users au ON rr.user_id = au.id
WHERE up.role != 'manager' OR up.role IS NULL;

-- Migration: Add inspector fields to existing table
-- Run this if you already have the table created:
-- ALTER TABLE repair_recommendations ADD COLUMN IF NOT EXISTS inspection_date DATE;
-- ALTER TABLE repair_recommendations ADD COLUMN IF NOT EXISTS inspector_name TEXT;