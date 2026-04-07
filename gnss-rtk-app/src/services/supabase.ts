/**
 * Supabase client configuration.
 *
 * Replace these with your actual Supabase project credentials.
 * In production, use environment variables or a build config.
 */

import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Supabase SQL to run in the dashboard (SQL Editor):
 *
 * -- User profiles with trial & subscription info
 * CREATE TABLE public.profiles (
 *   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *   email TEXT NOT NULL,
 *   full_name TEXT,
 *   trial_start TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   trial_days INTEGER NOT NULL DEFAULT 10,
 *   subscription_status TEXT NOT NULL DEFAULT 'trial',
 *     -- 'trial' | 'active' | 'expired' | 'cancelled'
 *   subscription_plan TEXT,
 *     -- 'monthly' | 'yearly' | null
 *   subscription_expires_at TIMESTAMPTZ,
 *   license_key TEXT,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Auto-create profile on user signup
 * CREATE OR REPLACE FUNCTION public.handle_new_user()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   INSERT INTO public.profiles (id, email, full_name)
 *   VALUES (
 *     NEW.id,
 *     NEW.email,
 *     COALESCE(NEW.raw_user_meta_data->>'full_name', '')
 *   );
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 *
 * CREATE TRIGGER on_auth_user_created
 *   AFTER INSERT ON auth.users
 *   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
 *
 * -- RLS policies
 * ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can read own profile"
 *   ON public.profiles FOR SELECT
 *   USING (auth.uid() = id);
 *
 * CREATE POLICY "Users can update own profile"
 *   ON public.profiles FOR UPDATE
 *   USING (auth.uid() = id)
 *   WITH CHECK (auth.uid() = id);
 */
