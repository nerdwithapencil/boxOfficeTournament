import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// The anon key is safe to ship in client-side code — it's the public key,
// meant to be embedded in browsers. Real access control lives in the
// database's row-level security policies (supabase/migrations/0001_init.sql).
const SUPABASE_URL = 'https://jqcdjkncdfppmdkndafl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxY2Rqa25jZGZwcG1ka25kYWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjQ5NTYsImV4cCI6MjEwMjQwMDk1Nn0.gTNYBBFEDF0rIyvH70IyFDHa2XZZAor3q2qQnBnv8hY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
