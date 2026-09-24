import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('mobile', '.env') });
dotenv.config({ path: path.resolve('.env'), override: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://192.168.137.1:8431';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching the most recent order to convert into a payable invoice...');
  
  // Get the most recent order
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('ord_id, estimate_amt')
    .order('order_timestamp', { ascending: false })
    .limit(1);

  if (oErr || !orders || orders.length === 0) {
    console.error('Failed to get any orders:', oErr);
    return;
  }

  const ordId = orders[0].ord_id;
  const amt = orders[0].estimate_amt || 50000;
  console.log(`Targeting Order: ${ordId}`);

  // 1. Update Order Status
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ approval_status: 'Payment Pending' })
    .eq('ord_id', ordId);
    
  if (updateErr) console.error("Order Update Err:", updateErr);

  // 2. Insert or Update Account with Invoice PDF
  const { data: existAcc } = await supabase.from('accounts').select('id').eq('ord_id', ordId).limit(1);
  
  if (existAcc && existAcc.length > 0) {
    const { error: accErr } = await supabase.from('accounts').update({
      invoice_pdf_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      final_invoiced_amount: amt
    }).eq('ord_id', ordId);
    if (accErr) console.error("Account Update Err:", accErr);
  } else {
    const { error: accErr } = await supabase.from('accounts').insert({
      ord_id: ordId,
      invoice_number: `INV-${Date.now()}`,
      invoice_pdf_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      final_invoiced_amount: amt,
      payment_due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    });
    if (accErr) console.error("Account Insert Err:", accErr);
  }

  console.log(`Successfully converted ${ordId} to Payment Pending with a dummy invoice PDF!`);
}

run();
