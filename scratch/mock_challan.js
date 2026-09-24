import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('mobile', '.env') });
dotenv.config({ path: path.resolve('.env'), override: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://192.168.137.1:8431';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Get 2 customers
  const { data: users, error: uErr } = await supabase.from('profiles').select('user_id').limit(2);
  if (uErr || !users || users.length === 0) {
    console.error('Failed to get valid users:', uErr);
    return;
  }

  const payload = [
    {
      challan_id: 'CHL-100101',
      user_id: users[0].user_id,
      date: new Date().toISOString(),
      depot: 'North Depot',
      grade: 'A+',
      quantity_deposited: 500
    },
    {
      challan_id: 'CHL-100102',
      user_id: users.length > 1 ? users[1].user_id : users[0].user_id,
      date: new Date(Date.now() - 86400000).toISOString(),
      depot: 'South Depot',
      grade: 'B',
      quantity_deposited: 200
    }
  ];

  console.log('Inserting mock challans with valid user IDs...');
  const { data, error } = await supabase.from('challans').insert(payload);
  
  if (error) {
    console.error('Error inserting mock challans:', error);
  } else {
    console.log('Mock challans inserted successfully!');
  }
}

run();
