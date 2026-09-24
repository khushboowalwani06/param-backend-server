import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:8431';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('email', 'customer@test.com')
    .single();
    
  console.log('Customer name:', profile?.name);

  const { error } = await supabase
    .from('profiles')
    .update({ approval_status: 'Pending Documents' })
    .eq('email', 'customer@test.com');
    
  if (error) {
    console.error('Error reverting profile:', error);
  } else {
    console.log('Profile reverted to Pending Documents');
  }
}

run();
