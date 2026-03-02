# Authentication System Setup Guide

The VoiceFlow Pro authentication system has been fully restored and is ready to use. Here's how to set it up:

## ✅ What's Been Implemented

### Authentication Components
- **LoginForm** - Complete login form with error handling
- **RegisterForm** - Registration form with password validation
- **ProtectedRoute** - Route protection component for authenticated pages
- **Layout** - Navigation layout with user menu and auth state
- **Auth Context** - Global authentication state management

### Pages
- `/auth/login` - User login page
- `/auth/register` - User registration page
- `/auth/confirm-email` - Email confirmation page
- `/dashboard` - Protected dashboard page (requires authentication)

### Features
- ✅ User registration with email/password
- ✅ User login with session management
- ✅ Protected routes that redirect to login
- ✅ User profile in navigation
- ✅ Sign out functionality
- ✅ Password reset capability
- ✅ Real-time auth state updates
- ✅ Graceful handling of missing Supabase configuration

## 🚀 Setup Instructions

### 1. Configure Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from the Supabase dashboard
3. Create a `.env.local` file in the `apps/web` directory:

```bash
# Copy from .env.local.example
cp .env.local.example .env.local
```

4. Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Set Up Database Tables

Run these SQL commands in your Supabase SQL editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create transcripts table
CREATE TABLE transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  duration INTEGER DEFAULT 0,
  language TEXT DEFAULT 'en',
  file_url TEXT,
  transcript_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Set up Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Transcripts policies
CREATE POLICY "Users can view own transcripts" ON transcripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transcripts" ON transcripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transcripts" ON transcripts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transcripts" ON transcripts
  FOR DELETE USING (auth.uid() = user_id);

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3. Enable Email Authentication

In your Supabase dashboard:
1. Go to Authentication → Providers
2. Enable Email provider
3. Configure email templates as needed

## 🧪 Testing the Authentication

### Without Supabase Configuration
The app will work but show appropriate warnings:
- Login/Register forms will show error messages
- Dashboard will redirect to login
- Whisper Demo remains fully functional

### With Supabase Configuration
1. Start the development server: `npm run dev`
2. Navigate to `/auth/register` to create an account
3. Check your email for confirmation (if email is enabled)
4. Login at `/auth/login`
5. Access the protected `/dashboard` page

## 📁 File Structure

```
src/
├── lib/
│   ├── auth-context.tsx    # Authentication context and hooks
│   ├── supabase.ts        # Supabase client configuration
│   └── utils.ts           # Auth utilities and validators
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx      # Login form component
│   │   ├── RegisterForm.tsx   # Registration form component
│   │   └── ProtectedRoute.tsx # Route protection wrapper
│   └── layout/
│       └── Layout.tsx         # App layout with navigation
└── app/
    ├── auth/
    │   ├── login/page.tsx      # Login page
    │   ├── register/page.tsx   # Registration page
    │   └── confirm-email/page.tsx # Email confirmation
    └── dashboard/page.tsx      # Protected dashboard
```

## 🔒 Security Features

- Password validation (min 6 chars, uppercase, lowercase, numbers)
- Secure session management
- Row Level Security (RLS) on all tables
- Protected API routes with JWT verification
- Automatic session refresh
- CSRF protection built-in

## 🛠️ Customization

### Password Requirements
Edit validation in `src/lib/utils.ts`:
```typescript
export function validatePassword(password: string)
```

### Redirect Paths
- After login: Edit in `auth-context.tsx` → `signIn()`
- After logout: Edit in `auth-context.tsx` → `signOut()`
- Protected route redirect: Pass `redirectTo` prop to `ProtectedRoute`

### Styling
All components use Tailwind CSS and can be customized in their respective files.

## 🚨 Troubleshooting

### "Supabase is not configured" errors
- Ensure `.env.local` exists with correct values
- Restart the dev server after adding env variables
- Check that the URL starts with `https://`

### Authentication not working
- Verify Supabase project is active
- Check browser console for errors
- Ensure email provider is enabled in Supabase

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Clear `.next` folder and rebuild: `rm -rf .next && npm run build`

## 📞 Support

For issues with:
- Supabase setup: Visit [supabase.com/docs](https://supabase.com/docs)
- Next.js auth: Check [Next.js auth docs](https://nextjs.org/docs/authentication)
- This implementation: Check the code comments or create an issue