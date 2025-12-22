import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://fqcjmrcnvrtqcytweyce.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxY2ptcmNudnJ0cWN5dHdleWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MjgzNTEsImV4cCI6MjA1NDAwNDM1MX0.wikCIj1tRlJuF7NDRn913fWdq1riabtmUGUxNOezFVM';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});