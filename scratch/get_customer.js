import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:8431';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email, password, role')
    .eq('role', 'customer')
    .limit(10);
    
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(profiles, null, 2));
  }
}

run();
