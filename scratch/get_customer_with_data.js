import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:8431';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('user_id')
    .limit(10);
    
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }
  
  const userIds = [...new Set(orders.map(o => o.user_id))].filter(Boolean);
  if (userIds.length > 0) {
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('email, password, role')
      .in('user_id', userIds);
    if (!pError) {
      console.log(JSON.stringify(profiles, null, 2));
      return;
    }
  }
  console.log("No users found with orders");
}

run();
