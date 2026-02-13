import { createClient } from '@supabase/supabase-js';

export interface SavedMessage {
  id?: number;
  relationship: string;
  tone: string;
  message_text: string;
  provider: string;
  created_at?: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
