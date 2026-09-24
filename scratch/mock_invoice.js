import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('api', '.env') });
dotenv.config({ path: path.resolve('.env'), override: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const ordId = 'ORD-1004';
  
  // 1. Update Order Status
  const { data: orderData, error: orderErr } = await supabase
    .from('orders')
    .update({ approval_status: 'Payment Pending' })
    .eq('ord_id', ordId);
    
  console.log("Order Update Err:", orderErr);

  // 2. Insert or Update Account
  const { data: existAcc } = await supabase.from('accounts').select('id').eq('ord_id', ordId).limit(1);
  
  if (existAcc && existAcc.length > 0) {
    const { error: accErr } = await supabase.from('accounts').update({
      invoice_pdf_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      final_invoiced_amount: 110000
    }).eq('ord_id', ordId);
    console.log("Account Update Err:", accErr);
  } else {
    const { error: accErr } = await supabase.from('accounts').insert({
      ord_id: ordId,
      invoice_number: `INV-${Date.now()}`,
      invoice_pdf_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      final_invoiced_amount: 110000,
      payment_due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    });
    console.log("Account Insert Err:", accErr);
  }
}

run();
