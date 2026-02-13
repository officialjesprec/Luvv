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

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // Fallback to null to prevent crash, handled in ai-gateway.ts
