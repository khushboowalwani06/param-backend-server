import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config({ override: true });

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- SUPABASE SETUP ---
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
console.log('Using Service Role Key?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = createClient(supabaseUrl, supabaseKey);

// --- JWT SETUP ---
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod';

app.get('/api/test-update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('orders')
      .update({ approval_status: 'Sales Rejected' })
      .eq('ord_id', id)
      .select().single();
    if (error) throw error;
    res.json({ success: true, order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token; // Bearer TOKEN or query param

  if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden: Invalid token' });
    req.user = user;
    next();
  });
};

// --- WEB PUSH SETUP ---
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BIV9fWaADe-5IutQRBzBXpKiwQLc_2Iyw_h2uk5OPOSMVgxz9szkzxerCDAA1DcXsH6pNLLmICsphtpeYlsIluo';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '-MOxGgwc9pk0OrK5Zzt2XDD-64-F-P_DCVqLgl5R-wo';
webpush.setVapidDetails('mailto:test@example.com', publicVapidKey, privateVapidKey);

app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: publicVapidKey });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', engine: 'supabase' });
});

// Helper for PascalCase profile
const mapProfile = (p) => {
  return {
    UserID: p.user_id,
    Email: p.email,
    Password: p.password,
    Role: p.role,
    Name: p.name,
    Company: p.company,
    Phone: p.phone,
    Address: p.address,
    City: p.city,
    District: p.district,
    Zone: p.zone,
    AssignedSalesRep: p.assigned_sales_rep,
    PushSubscriptions: p.push_subscriptions,
    TotalOrdersPlaced: p.total_orders_placed,
    TotalOrdersClosedOnTime: p.total_orders_closed_on_time,
    TotalOrdersOverdue: p.total_orders_overdue,
    Segment: p.segment,
    CreditLimit: p.credit_limit,
    AllowedPaymentDays: p.allowed_payment_days,
    OutstandingAmount: p.outstanding_amount,
    BlockedStatus: p.blocked_status,
    ManualUnlock: p.manual_unlock,
    BPID: p.bpid,
    NonTradeActivated: p.non_trade_activated,
    ApprovalStatus: p.approval_status,
    RejectionReason: p.rejection_reason,
    Documents: {
      aadhar: p.document_aadhar,
      pan: p.document_pan,
      gst: p.document_gst,
      companyPan: p.document_company_pan,
      bankCheque: p.document_bank_cheque
    },
    Bkt0_1: p.bkt_0_1,
    Bkt2_4: p.bkt_2_4,
    Bkt5_5: p.bkt_5_5,
    Bkt6_7: p.bkt_6_7,
    Bkt8_15: p.bkt_8_15,
    Bkt16_20: p.bkt_16_20,
    Bkt21_Above: p.bkt_21_above
  };
};

// Helper for sync is now imported from sheetsSync.js
// Setup endpoint removed in favor of Supabase migrations.

// --- PUBLIC ENDPOINTS ---
app.get('/api/public/districts', async (req, res) => {
  try {
    const { data: mappings, error } = await supabase.from('zone_mappings').select('districts');
    if (error) throw error;
    
    let allDistricts = [];
    mappings.forEach(m => {
      if (m.districts) {
        const parts = m.districts.split(',').map(d => d.trim()).filter(d => d);
        allDistricts = allDistricts.concat(parts);
      }
    });
    
    // Capitalize first letter of each word and remove duplicates
    const uniqueDistricts = [...new Set(allDistricts.map(d => {
      return d.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }))].sort();
    
    res.json(uniqueDistricts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUTH ENDPOINTS ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, role, name, company, phone, address, city, tehsil, district, state, zipCode, segment, credit_limit, allowed_payment_days, outstanding_amount, blocked_status, manual_unlock, bpid, non_trade_activated, gstin, documents } = req.body;

    // Use bpid as user_id if available, otherwise generate a unique 8-character alphanumeric ID
    const newUserId = bpid ? String(bpid) : `USR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    let assigned_sales_rep = null;
    const isCustomerType = role === 'customer' || role === 'dealer' || role === 'retailer';

    if (isCustomerType) {
      try {
        const { data: salesUsers } = await supabase.from('profiles').select('user_id').eq('role', 'sales');
        if (salesUsers && salesUsers.length > 0) {
          const { data: allUsers } = await supabase.from('profiles').select('assigned_sales_rep').not('assigned_sales_rep', 'is', null);
          const counts = {};
          salesUsers.forEach(su => counts[su.user_id] = 0);
          if (allUsers) {
            allUsers.forEach(u => {
              if (counts[u.assigned_sales_rep] !== undefined) {
                counts[u.assigned_sales_rep]++;
              }
            });
          }
          let minRep = salesUsers[0].user_id;
          let minCount = counts[minRep];
          for (let rep of salesUsers) {
            if (counts[rep.user_id] < minCount) {
              minCount = counts[rep.user_id];
              minRep = rep.user_id;
            }
          }
          assigned_sales_rep = minRep;
        }
      } catch (err) {
        console.error('Error auto-assigning sales rep:', err);
      }
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .insert([{
        user_id: newUserId,
        email,
        password: password,
        role,
        name,
        company: company || '',
        phone: phone || '',
        address: address || '',
        city: city || '',
        tehsil: tehsil || '',
        district: district || '',
        state: state || '',
        zip_code: zipCode || '',
        segment: segment || (isCustomerType ? 'Trade' : 'Non-Trade'),
        credit_limit: credit_limit !== undefined ? credit_limit : (isCustomerType ? 100000 : 0),
        allowed_payment_days: allowed_payment_days || 21,
        outstanding_amount: outstanding_amount || 0,
        blocked_status: blocked_status || false,
        manual_unlock: manual_unlock || false,
        bpid: gstin || bpid || `BP-${Math.floor(1000 + Math.random() * 9000)}`,
        non_trade_activated: non_trade_activated || false,
        assigned_sales_rep: assigned_sales_rep,
        approval_status: isCustomerType ? 'Pending' : 'Approved',
        document_aadhar: documents?.aadhar || null,
        document_pan: documents?.pan || null,
        document_gst: documents?.gst || null,
        document_company_pan: documents?.companyPan || null,
        document_bank_cheque: documents?.bankCheque || null
      }])
      .select('user_id, customer_id, email, password, role, name, company, phone, address, city, segment, credit_limit, allowed_payment_days, outstanding_amount, blocked_status, manual_unlock, bpid, non_trade_activated, approval_status, assigned_sales_rep, bkt_0_1, bkt_2_4, bkt_5_5, bkt_6_7, bkt_8_15, bkt_16_20, bkt_21_above, document_pan, document_gst, district, zone')
      .single();

    if (error) throw error;

    // After inserting profile, calculate and update the zone
    if (district) {
      try {
        const { data: mappingData } = await supabase.from('zone_mappings').select('*');
        const dynamicMappings = mappingData || [];
        
        let calculatedZone = 'Unknown Zone';
        const d = district.toLowerCase().trim();
        for (const mapping of dynamicMappings) {
          if (!mapping.districts) continue;
          const mappedDistricts = mapping.districts.split(',').map(s => s.toLowerCase().trim());
          if (mappedDistricts.includes(d)) {
            calculatedZone = mapping.zone;
            break;
          }
        }
        
        await supabase.from('profiles').update({ zone: calculatedZone }).eq('user_id', newUserId);
      } catch (err) {
        console.error('Error assigning zone during registration:', err);
      }
    }

    const token = jwt.sign({ user_id: profile.user_id, role: profile.role }, jwtSecret, { expiresIn: '7d' });
    res.json({ success: true, user: mapProfile(profile), token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/approve-user', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { user_id, action, rejection_reason } = req.body;
  try {
    const status = action === 'approve' ? 'Approved' : 'Rejected';
    const updatePayload = { approval_status: status };
    if (status === 'Rejected' && rejection_reason) {
      updatePayload.rejection_reason = rejection_reason;
    } else if (status === 'Approved') {
      updatePayload.rejection_reason = null; // Clear if previously rejected
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('user_id', user_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, user: mapProfile(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const sanitizedEmail = (email || '').trim().toLowerCase();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id, customer_id, email, password, role, name, company, phone, address, city, segment, credit_limit, allowed_payment_days, outstanding_amount, blocked_status, manual_unlock, bpid, non_trade_activated, approval_status, assigned_sales_rep, bkt_0_1, bkt_2_4, bkt_5_5, bkt_6_7, bkt_8_15, bkt_16_20, bkt_21_above, document_pan, document_gst, district, zone')
      .or(`email.eq.${sanitizedEmail},customer_id.ilike.${sanitizedEmail}`)
      .single();

    if (error || !profile) {
      console.error('Supabase login error:', error);
      return res.status(401).json({ error: 'Invalid email or password', details: error ? error.message : 'Profile not found' });
    }

    if (profile.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ user_id: profile.user_id, role: profile.role }, jwtSecret, { expiresIn: '7d' });
    res.json({ success: true, user: mapProfile(profile), token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id, customer_id, email, password, role, name, company, phone, address, city, segment, credit_limit, allowed_payment_days, outstanding_amount, blocked_status, manual_unlock, bpid, non_trade_activated, approval_status, assigned_sales_rep, bkt_0_1, bkt_2_4, bkt_5_5, bkt_6_7, bkt_8_15, bkt_16_20, bkt_21_above, document_pan, document_gst, district, zone')
      .eq('user_id', req.user.user_id)
      .maybeSingle();
    if (error) throw error;
    if (!profile) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    // Fetch live ageing for this user
    const { data: liveAgeing, error: ageingErr } = await supabase.rpc('get_all_customers_ageing');
    if (!ageingErr && liveAgeing) {
      const live = liveAgeing.find(a => a.user_id === req.user.user_id);
      if (live) {
        profile.outstanding_amount = live.outstanding;
        profile.bkt_0_1 = live.bkt_0_1;
        profile.bkt_2_4 = live.bkt_2_4;
        profile.bkt_5_5 = live.bkt_5_5;
        profile.bkt_6_7 = live.bkt_6_7;
        profile.bkt_8_15 = live.bkt_8_15;
        profile.bkt_16_20 = live.bkt_16_20;
        profile.bkt_21_above = live.bkt_21_above;
      }
    }

    res.json({ success: true, user: mapProfile(profile) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/user/documents', authenticateToken, async (req, res) => {
  try {
    // Only admins or the user themselves should be able to fetch their documents
    const { data, error } = await supabase.from('profiles').select('document_aadhar, document_pan, document_gst, document_company_pan, document_bank_cheque').eq('user_id', req.user.user_id).single();
    if (error) throw error;
    res.json({
      success: true, documents: {
        aadhar: data.document_aadhar,
        pan: data.document_pan,
        gst: data.document_gst,
        companyPan: data.document_company_pan,
        bankCheque: data.document_bank_cheque
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/resubmit', authenticateToken, async (req, res) => {
  try {
    const { documents } = req.body;
    const payload = {
      approval_status: 'Pending',
      rejection_reason: null
    };

    if (documents) {
      if (documents.aadhar) payload.document_aadhar = documents.aadhar;
      if (documents.pan) payload.document_pan = documents.pan;
      if (documents.gst) payload.document_gst = documents.gst;
      if (documents.companyPan) payload.document_company_pan = documents.companyPan;
      if (documents.bankCheque) payload.document_bank_cheque = documents.bankCheque;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', req.user.user_id)
      .select()
      .single();

    if (error) throw error;
    res.json(mapProfile(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- BULK IMPORT ENDPOINTS ---
app.post('/api/admin/bulk-import-customers', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { customers } = req.body;
    if (!customers || !Array.isArray(customers)) return res.status(400).json({ error: 'Invalid data format' });

    // Fetch dynamic zone mappings from DB
    const { data: mappingData } = await supabase.from('zone_mappings').select('*');
    const dynamicMappings = mappingData || [];

    // Mapping function from District to Zone using DB mappings
    const mapDistrictToZone = (district) => {
      if (!district) return 'Unknown Zone';
      const d = district.toLowerCase().trim();
      
      for (const mapping of dynamicMappings) {
        if (!mapping.districts) continue;
        const mappedDistricts = mapping.districts.split(',').map(s => s.toLowerCase().trim());
        if (mappedDistricts.includes(d)) {
          return mapping.zone;
        }
      }
      return 'Unknown Zone';
    };

    let count = 0;
    
    // Setup round-robin sales rep assignment logic
    const { data: salesUsers } = await supabase.from('profiles').select('user_id').eq('role', 'sales');
    const counts = {};
    if (salesUsers && salesUsers.length > 0) {
      salesUsers.forEach(su => counts[su.user_id] = 0);
      const { data: allUsers } = await supabase.from('profiles').select('assigned_sales_rep').not('assigned_sales_rep', 'is', null);
      if (allUsers) {
        allUsers.forEach(u => {
          if (counts[u.assigned_sales_rep] !== undefined) {
            counts[u.assigned_sales_rep]++;
          }
        });
      }
    }

    for (const c of customers) {
      const bpid = c.custNum;
      if (!bpid) continue;

      // check if exists
      const { data: existing, error: existErr } = await supabase.from('profiles').select('user_id').eq('bpid', bpid).maybeSingle();
      
      if (existErr) {
        if (existErr.code === 'PGRST116') {
          throw new Error(`Multiple profiles exist with Customer ID ${bpid}. Cannot update safely.`);
        }
        throw new Error(`Error checking customer ${bpid}: ${existErr.message}`);
      }

      if (existing) {
        const updatePayload = { customer_id: bpid };
        if (c.email) updatePayload.email = c.email;
        if (c.password) updatePayload.password = c.password;
        if (c.name) {
          updatePayload.name = c.name;
          updatePayload.company = c.name;
        }
        if (c.address) updatePayload.address = c.address;
        if (c.city) updatePayload.city = c.city;
        if (c.tehsil) updatePayload.tehsil = c.tehsil;
        if (c.district) {
          updatePayload.district = c.district;
          updatePayload.zone = mapDistrictToZone(c.district);
        }
        if (c.state) updatePayload.state = c.state;
        if (c.zip_code) updatePayload.zip_code = c.zip_code;
        if (c.phone) updatePayload.phone = c.phone;
        if (c.segment) updatePayload.segment = c.segment;
        if (c.pan) updatePayload.document_pan = c.pan;
        if (c.gst) updatePayload.document_gst = c.gst;

        const { error: updateErr } = await supabase.from('profiles').update(updatePayload).eq('user_id', existing.user_id);
        if (updateErr) throw new Error(`Failed to update customer ${bpid}: ${updateErr.message}`);
        count++;
        continue;
      }

      // Use the Customer ID directly as the user_id
      const newUserId = String(bpid);
      
      let assigned_sales_rep = null;
      if (salesUsers && salesUsers.length > 0) {
        let minRep = salesUsers[0].user_id;
        let minCount = counts[minRep];
        for (let rep of salesUsers) {
          if (counts[rep.user_id] < minCount) {
            minCount = counts[rep.user_id];
            minRep = rep.user_id;
          }
        }
        assigned_sales_rep = minRep;
        counts[minRep]++; // increment for the next customer
      }

      const { error: insertErr } = await supabase.from('profiles').insert([{
        user_id: newUserId,
        email: c.email || `${String(bpid).toLowerCase().replace(/[^a-z0-9]/g, '')}@no-email.com`,
        password: c.password || 'password123',
        customer_id: bpid,
        role: 'customer',
        name: c.name || 'Unknown',
        company: c.name || 'Unknown',
        bpid: bpid,
        approval_status: 'Approved', // Auto-approve imported customers
        assigned_sales_rep: assigned_sales_rep,
        address: c.address || '',
        city: c.city || '',
        tehsil: c.tehsil || null,
        district: c.district || null,
        state: c.state || null,
        zip_code: c.zip_code || null,
        zone: mapDistrictToZone(c.district),
        phone: c.phone || '',
        segment: c.segment || 'Trade',
        document_pan: c.pan || null,
        document_gst: c.gst || null
      }]);
      
      if (insertErr) throw new Error(`Failed to insert customer ${bpid}: ${insertErr.message}`);
      count++;
    }
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/bulk-import-rewards', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { rewards } = req.body;
    if (!rewards || !Array.isArray(rewards)) return res.status(400).json({ error: 'Invalid data format' });

    let count = 0;
    for (const r of rewards) {
      const bpid = r.custNum;
      if (!bpid) continue;
      
      const { data: profile, error: existErr } = await supabase.from('profiles').select('user_id').eq('bpid', bpid).maybeSingle();
      
      if (existErr && existErr.code !== 'PGRST116') {
        throw new Error(`Error checking customer ${bpid}: ${existErr.message}`);
      }
      if (!profile) continue; // Skip if user not found

      const rewardsData = {
        targets: []
      };
      
      if (r.target1 && r.item1) {
        rewardsData.targets.push({ id: 1, target: Number(r.target1), rewardName: String(r.item1).trim(), rewardImage: 'Gift', color: '#94a3b8' });
      }
      if (r.target2 && r.item2) {
        rewardsData.targets.push({ id: 2, target: Number(r.target2), rewardName: String(r.item2).trim(), rewardImage: 'Trophy', color: '#fbbf24' });
      }

      const { error: updateErr } = await supabase.from('profiles').update({ rewards: rewardsData }).eq('user_id', profile.user_id);
      if (updateErr) throw new Error(`Failed to update rewards for ${bpid}: ${updateErr.message}`);
      count++;
    }
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REST Endpoints ---
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('orders').select('*, payments (amount), accounts (invoice_pdf_link, payment_proof_link, payment_reference, final_invoiced_amount)');

    // Server-side filtering for performance & security
    if (req.user.role === 'customer' || req.user.role === 'dealer' || req.user.role === 'retailer') {
      query = query.eq('user_id', req.user.user_id);
    }
    
    // Sort by primary key to use index and avoid massive TOAST data sort timeouts, limit to 50
    query = query.order('ord_id', { ascending: false }).limit(50);
    // Note: Sales reps can now see all orders (logic removed as per user request)

    const { data: orders, error } = await query;
    if (error) throw error;


    const mapped = orders.map(o => {
      // Handle both array and object returns for accounts join
      const acc = Array.isArray(o.accounts) ? o.accounts[0] : o.accounts;
      
      return {
        OrdID: o.ord_id,
        UserID: o.user_id,
        Name: o.name,
        Company: o.company,
        Phone: o.phone,
        Email: o.email,
        Address: o.address,
        City: o.city,
        EstimateQty: o.estimate_qty,
        Product: o.product,
        EstimateAmt: o.estimate_amt,
        ProjectType: o.project_type,
        Timeline: o.timeline,
        Notes: o.notes,
        AudioData: o.audio_data,
        ApprovalStatus: o.approval_status,
        RejectionReason: o.rejection_reason,
        SalesApproverID: o.sales_approver_id,
        AdminApproverID: o.admin_approver_id,
        DispatchStatus: o.dispatch_status,
        DeliveryConfirmedTimestamp: o.delivery_confirmed_timestamp,
        DeliveryIssueFlag: o.delivery_issue_flag,
        InvoiceStatus: o.invoice_status,
        OrderTimestamp: o.order_timestamp,
        BagPrice: o.bag_price,
        TonPrice: o.ton_price,
        CurrentStage: o.current_stage,
        SalesApprovalDate: o.sales_approval_date,
        AdminApprovalStatus: o.admin_approval_status,
        AdminApprovalDate: o.admin_approval_date,
        TransportName: o.transport_name,
        VehicleNumber: o.vehicle_number,
        TrackingNumber: o.tracking_number,
        ReceiverName: o.receiver_name,
        ReceiverContact: o.receiver_contact,
        DeliveryRemarks: o.delivery_remarks,
        DeliveryStatus: o.delivery_status,
        PaidAmount: o.payments ? o.payments.reduce((sum, p) => sum + Number(p.amount), 0) : 0,
        InvoicePdfLink: acc?.invoice_pdf_link || o.invoice_pdf_link,
        PaymentProofLink: acc?.payment_proof_link || o.payment_proof_link,
        TransactionID: acc?.payment_reference || o.transaction_id,
        FinalInvoicedAmount: acc?.final_invoiced_amount || o.final_invoiced_amount
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const newOrder = req.body;
    if (!newOrder.LogisticsPersonnelID) {
      newOrder.LogisticsPersonnelID = `LOG-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const orderData = {
      ord_id: newOrder.OrdID,
      user_id: newOrder.UserID,
      name: newOrder.Name,
      company: newOrder.Company,
      phone: newOrder.Phone,
      email: newOrder.Email,
      address: newOrder.OrderAddress || newOrder.Address,
      city: newOrder.OrderCity || newOrder.City,
      delivery_tehsil: newOrder.OrderTehsil,
      delivery_district: newOrder.OrderDistrict,
      delivery_state: newOrder.OrderState,
      delivery_zip: newOrder.OrderZip,
      estimate_qty: newOrder.EstimateQty,
      product: newOrder.Product,
      estimate_amt: newOrder.EstimateAmt,
      project_type: newOrder.ProjectType,
      timeline: newOrder.Timeline,
      notes: newOrder.Notes,
      audio_data: newOrder.AudioData,
      approval_status: newOrder.ApprovalStatus,
      order_timestamp: newOrder.OrderTimestamp || new Date().toISOString(),
      bag_price: newOrder.BagPrice,
      ton_price: newOrder.TonPrice,
      current_stage: newOrder.CurrentStage,
      sales_approval_date: newOrder.SalesApprovalDate,
      admin_approval_status: newOrder.AdminApprovalStatus,
      admin_approval_date: newOrder.AdminApprovalDate,
      transport_name: newOrder.TransportName,
      vehicle_number: newOrder.VehicleNumber,
      tracking_number: newOrder.TrackingNumber,
      receiver_name: newOrder.ReceiverName,
      receiver_contact: newOrder.ReceiverContact,
      delivery_remarks: newOrder.DeliveryRemarks,
      delivery_status: newOrder.DeliveryStatus,
      logistics_personnel_id: newOrder.LogisticsPersonnelID,
      customer_name: newOrder.Customer_Name,
      bpid: newOrder.Linked_BPner_Accou,
      state_name: newOrder.State_Name || 'Gujarat',
      district_id: newOrder.District_id || newOrder.City,
      city_id: newOrder.City_id || newOrder.City,
      order_segment: newOrder.Segment,
      unit: newOrder.Unit
    };

    const { error: rpcError } = await supabase.rpc('place_order_atomic', {
      p_order_data: orderData
    });

    if (rpcError) {
      if (rpcError.message.includes('Account is blocked') || rpcError.message.includes('Account automatically blocked') || rpcError.message.includes('Credit limit exceeded')) {
        return res.status(403).json({ error: rpcError.message });
      }
      throw rpcError;
    }

    const msg = `data: ${JSON.stringify({ table: 'orders', payload: { eventType: 'INSERT' } })}\n\n`;
    sseClients.forEach(c => c.write(msg));

    res.json({ success: true, LogisticsPersonnelID: newOrder.LogisticsPersonnelID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Authorization: only Admin can freely edit pending orders for now
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only admin can edit order details' });
    }

    const { Product, EstimateQty, Unit, UnitPrice, EstimateAmt } = req.body;
    
    const payload = {};
    if (Product !== undefined) payload.product = Product;
    if (EstimateQty !== undefined) payload.estimate_qty = EstimateQty;
    if (EstimateAmt !== undefined) payload.estimate_amt = EstimateAmt;
    if (Unit !== undefined) payload.unit = Unit;
    if (UnitPrice !== undefined) {
      if (Unit === 'Bags') payload.bag_price = UnitPrice;
      else payload.ton_price = UnitPrice;
    }
    const { data, error } = await supabase
      .from('orders')
      .update(payload)
      .eq('ord_id', id)
      .select().single();

    if (error) throw error;
    res.json({ success: true, order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/price', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newAmt } = req.body;

    const { data, error } = await supabase
      .from('orders')
      .update({ estimate_amt: newAmt })
      .eq('ord_id', id)
      .select().single();

    if (error) throw error;
    res.json({ success: true, order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, updateFields } = req.body;

    const payload = { approval_status: newStatus };
    if (updateFields) {
      if (updateFields.SalesApproverID) payload.sales_approver_id = updateFields.SalesApproverID;
      if (updateFields.EstimateQty !== undefined) payload.estimate_qty = updateFields.EstimateQty;
      if (updateFields.EstimateAmt !== undefined) payload.estimate_amt = updateFields.EstimateAmt;
      if (updateFields.AdminApproverID) payload.admin_approver_id = updateFields.AdminApproverID;
      if (updateFields.DispatchStatus) payload.dispatch_status = updateFields.DispatchStatus;
      if (updateFields.DeliveryConfirmedTimestamp) payload.delivery_confirmed_timestamp = updateFields.DeliveryConfirmedTimestamp;
      if (updateFields.SalesApprovalDate) payload.sales_approval_date = updateFields.SalesApprovalDate;
      if (updateFields.AdminApprovalStatus) payload.admin_approval_status = updateFields.AdminApprovalStatus;
      if (updateFields.AdminApprovalDate) payload.admin_approval_date = updateFields.AdminApprovalDate;
      if (updateFields.CurrentStage) payload.current_stage = updateFields.CurrentStage;
      if (updateFields.TransportName) payload.transport_name = updateFields.TransportName;
      if (updateFields.VehicleNumber) payload.vehicle_number = updateFields.VehicleNumber;
      if (updateFields.TrackingNumber) payload.tracking_number = updateFields.TrackingNumber;
      if (updateFields.ReceiverName) payload.receiver_name = updateFields.ReceiverName;
      if (updateFields.ReceiverContact) payload.receiver_contact = updateFields.ReceiverContact;
      if (updateFields.DeliveryRemarks) payload.delivery_remarks = updateFields.DeliveryRemarks;
      if (updateFields.DeliveryStatus) payload.delivery_status = updateFields.DeliveryStatus;
      if (updateFields.RejectionReason) payload.rejection_reason = updateFields.RejectionReason;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(payload)
      .eq('ord_id', id)
      .select().single();

    if (error) throw error;

    const msg = `data: ${JSON.stringify({ table: 'orders', payload: { eventType: 'UPDATE' } })}\n\n`;
    sseClients.forEach(c => c.write(msg));

    res.json({ success: true, order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('orders').delete().eq('ord_id', id).select().single();
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PRODUCTS ENDPOINTS ---
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { data: products, error } = await supabase.from('products').select('*');
    if (error) throw error;

    const mapped = products.map(p => ({
      ProductID: p.product_id,
      ProductName: p.product_name,
      Grade: p.grade,
      BagPrice: p.bag_price,
      TonPrice: p.ton_price,
      NonTradeBagPrice: p.price,
      NonTradeTonPrice: p.unit_price
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const newProduct = {
      product_id: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      product_name: typeof req.body.ProductName === 'string' ? req.body.ProductName.trim() : req.body.ProductName,
      grade: req.body.Grade,
      bag_price: 0,
      ton_price: 0,
      price: 0,
      unit_price: 0 // Satisfies constraint & holds Non-Trade ton price
    };

    const { data, error } = await supabase.from('products').insert([newProduct]).select().single();
    if (error) throw error;
    res.json({
      success: true, product: {
        ProductID: data.product_id,
        ProductName: data.product_name,
        BagPrice: data.bag_price,
        TonPrice: data.ton_price,
        NonTradeBagPrice: data.price,
        NonTradeTonPrice: data.unit_price
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ProductName, BagPrice, TonPrice, NonTradeBagPrice, NonTradeTonPrice } = req.body;

    const payload = {};
    if (ProductName) payload.product_name = typeof ProductName === 'string' ? ProductName.trim() : ProductName;
    if (BagPrice !== undefined) payload.bag_price = BagPrice;
    if (TonPrice !== undefined) payload.ton_price = TonPrice;
    if (NonTradeBagPrice !== undefined) payload.price = NonTradeBagPrice;
    if (NonTradeTonPrice !== undefined) payload.unit_price = NonTradeTonPrice;

    // Safety fallback for not-null constraint if not updating unit_price explicitly
    if (payload.unit_price === undefined && payload.ton_price !== undefined) {
       // We only do this if it's genuinely missing, but usually the DB just keeps the old value on PATCH
    }

    const { error } = await supabase.from('products').update(payload).eq('product_id', id).select().single();
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('product_id', id).select().single();
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USERS ENDPOINTS ---
// Fetch the first designated admin profile for customer support cards
app.get('/api/admin-contact', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('name').eq('role', 'admin').limit(1).single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows
    res.json({ name: data?.name || 'Param Admin' });
  } catch (error) {
    console.error('Error fetching admin contact:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const { pendingOnly } = req.query;

    let selectFields = 'user_id, customer_id, email, password, role, name, company, phone, address, city, segment, credit_limit, allowed_payment_days, outstanding_amount, blocked_status, manual_unlock, bpid, non_trade_activated, approval_status, assigned_sales_rep, bkt_0_1, bkt_2_4, bkt_5_5, bkt_6_7, bkt_8_15, bkt_16_20, bkt_21_above, rejection_reason, push_subscriptions, total_orders_placed, total_orders_closed_on_time, total_orders_overdue, document_pan, document_gst, district, zone';

    let query = supabase.from('profiles').select(selectFields);

    if (pendingOnly === 'true') {
      query = query.eq('approval_status', 'Pending');
    }

    const { data: users, error } = await query;
    if (error) throw error;

    // Fetch live ageing for all users to display in the UI (Customer Ageing dashboard)
    const { data: liveAgeing, error: ageingErr } = await supabase.rpc('get_all_customers_ageing');

    const ageingMap = {};
    if (!ageingErr && liveAgeing) {
      liveAgeing.forEach(a => {
        ageingMap[a.user_id] = a;
      });
    }

    const mapped = users.map(u => {
      // If live ageing data is found, override the static profile columns
      if (ageingMap[u.user_id]) {
        const live = ageingMap[u.user_id];
        u.outstanding_amount = live.outstanding;
        u.bkt_0_1 = live.bkt_0_1;
        u.bkt_2_4 = live.bkt_2_4;
        u.bkt_5_5 = live.bkt_5_5;
        u.bkt_6_7 = live.bkt_6_7;
        u.bkt_8_15 = live.bkt_8_15;
        u.bkt_16_20 = live.bkt_16_20;
        u.bkt_21_above = live.bkt_21_above;
      }
      return mapProfile(u);
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id/role', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newRole } = req.body;

    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('user_id', id).select().single();
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:id/documents', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'accountant', 'sales'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { id } = req.params;
    const { data, error } = await supabase.from('profiles').select('document_aadhar, document_pan, document_gst, document_company_pan, document_bank_cheque').eq('user_id', id).single();
    if (error) throw error;
    res.json({
      success: true,
      documents: {
        aadhar: data.document_aadhar,
        pan: data.document_pan,
        gst: data.document_gst,
        companyPan: data.document_company_pan,
        bankCheque: data.document_bank_cheque
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id/basic', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('profiles').select('name').eq('user_id', id).single();
    if (error) throw error;
    res.json({ name: data.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id/profile', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.user_id !== id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Can only update own profile' });
    }
    const { Name, Company, Phone, Address, City, Email, District, State, Segment, PAN, GST, Password, AssignedSalesRep } = req.body;

    const payload = {};
    if (Password) {
      // NOTE: Password updates here are NOT hashed because the admin needs to see the plaintext password.
      // This matches the spec for "Admins can view plaintext passwords of users".
      payload.password = Password;
    }
    if (Name !== undefined) payload.name = Name;
    if (Company !== undefined) payload.company = Company;
    if (Phone !== undefined) payload.phone = Phone;
    if (Address !== undefined) payload.address = Address;
    if (City !== undefined) payload.city = City;
    if (Email !== undefined) payload.email = Email;
    if (AssignedSalesRep !== undefined) payload.assigned_sales_rep = AssignedSalesRep;
    if (District !== undefined) {
      payload.district = District;
      // Also calculate zone!
      try {
        const { data: mappingData } = await supabase.from('zone_mappings').select('*');
        const dynamicMappings = mappingData || [];
        let calculatedZone = 'Unknown Zone';
        const d = District.toLowerCase().trim();
        for (const mapping of dynamicMappings) {
          if (!mapping.districts) continue;
          const mappedDistricts = mapping.districts.split(',').map(s => s.toLowerCase().trim());
          if (mappedDistricts.includes(d)) {
            calculatedZone = mapping.zone;
            break;
          }
        }
        payload.zone = calculatedZone;
      } catch (err) {
        console.error('Error calculating zone in patch:', err);
      }
    }
    if (State !== undefined) payload.state = State;
    if (Segment !== undefined) payload.segment = Segment;
    if (PAN !== undefined) payload.document_pan = PAN;
    if (GST !== undefined) payload.document_gst = GST;
    if (req.body.AssignedSalesRep !== undefined) payload.assigned_sales_rep = req.body.AssignedSalesRep === '' ? null : req.body.AssignedSalesRep;

    const { data, error } = await supabase.from('profiles').update(payload).eq('user_id', id).select().single();
    if (error) {
      throw error;
    }
    res.json({ success: true, user: mapProfile(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('profiles').delete().eq('user_id', id).select().single();
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id/rewards', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('profiles').select('rewards').eq('user_id', id).single();
    if (error) throw error;

    const defaultRewards = {
      targets: [
        { id: 1, target: 150, rewardName: 'Silver Tier Trip', rewardImage: 'Gift', color: '#94a3b8' },
        { id: 2, target: 280, rewardName: 'Gold Tier Trip (Dubai)', rewardImage: 'Trophy', color: '#fbbf24' }
      ]
    };

    res.json(data.rewards || defaultRewards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rewards/bulk', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('user_id, rewards').in('role', ['customer', 'retailer', 'dealer']);
    if (error) throw error;
    
    const defaultRewards = {
      targets: [
        { id: 1, target: 150, rewardName: 'Silver Tier Trip', rewardImage: 'Gift', color: '#94a3b8' },
        { id: 2, target: 280, rewardName: 'Gold Tier Trip (Dubai)', rewardImage: 'Trophy', color: '#fbbf24' }
      ]
    };
    
    const rewardsMap = {};
    if (data) {
      data.forEach(p => {
        rewardsMap[p.user_id] = p.rewards || defaultRewards;
      });
    }
    res.json(rewardsMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/aggregates', authenticateToken, async (req, res) => {
  try {
    const validStatuses = ['Pending Admin Approval', 'Ready for Dispatch', 'Dispatched', 'In Transit', 'Delivered', 'Payment Pending', 'Payment Sent', 'Closed'];
    const { data, error } = await supabase.from('orders').select('user_id, approval_status, estimate_qty').in('approval_status', validStatuses);
      
    if (error) throw error;
  
    const aggregates = {};
      
    data.forEach(o => {
      if (!aggregates[o.user_id]) {
        aggregates[o.user_id] = { count: 0, achievedValue: 0 };
      }
        
      aggregates[o.user_id].count += 1;
        
      let qty = Number(o.estimate_qty) || 0;
      aggregates[o.user_id].achievedValue += qty;
    });
  
    res.json(aggregates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id/rewards', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!['admin', 'sales', 'accountant'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Cannot manage rewards' });
    }

    const { rewards } = req.body;

    const { data, error } = await supabase.from('profiles').update({ rewards }).eq('user_id', id).select().single();
    if (error) throw error;

    res.json({ success: true, rewards: data.rewards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ACCOUNTS ENDPOINTS ---
app.get('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const { data: accounts, error } = await supabase.from('accounts').select('*');
    if (error) throw error;

    const mapped = accounts.map(a => ({
      OrdID: a.ord_id,
      InvoiceNumber: a.invoice_number,
      InvoicePdfLink: a.invoice_pdf_link,
      FinalInvoicedAmount: a.final_invoiced_amount,
      PaymentDueDate: a.payment_due_date,
      ReminderLog: a.reminder_log,
      PaymentSentFlag: a.payment_sent_flag,
      PaymentReference: a.payment_reference,
      PaymentProofLink: a.payment_proof_link,
      PaymentVerifiedBy: a.payment_verified_by,
      OverdueFlag: a.overdue_flag,
      GSTAmount: a.gst_amount,
      TotalAmount: a.total_amount,
      AccountsRemarks: a.accounts_remarks,
      VerificationDate: a.verification_date
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const newAccount = {
      ord_id: req.body.OrdID,
      invoice_number: req.body.InvoiceNumber,
      invoice_pdf_link: req.body.InvoicePdfLink,
      final_invoiced_amount: req.body.FinalInvoicedAmount,
      payment_due_date: req.body.PaymentDueDate,
      reminder_log: req.body.ReminderLog || '[]',
      payment_sent_flag: req.body.PaymentSentFlag || false,
      payment_reference: req.body.PaymentReference,
      payment_proof_link: req.body.PaymentProofLink,
      payment_verified_by: req.body.PaymentVerifiedBy,
      overdue_flag: req.body.OverdueFlag || false,
      gst_amount: req.body.GSTAmount,
      total_amount: req.body.TotalAmount,
      accounts_remarks: req.body.AccountsRemarks,
      verification_date: req.body.VerificationDate
    };

    const { error } = await supabase.from('accounts').insert([newAccount]).select().single();
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const payload = {};
    if ('InvoiceNumber' in updates) payload.invoice_number = updates.InvoiceNumber;
    if ('InvoicePdfLink' in updates) payload.invoice_pdf_link = updates.InvoicePdfLink;
    if ('FinalInvoicedAmount' in updates) payload.final_invoiced_amount = updates.FinalInvoicedAmount;
    if ('PaymentDueDate' in updates) payload.payment_due_date = updates.PaymentDueDate;
    if ('ReminderLog' in updates) payload.reminder_log = updates.ReminderLog;
    if ('PaymentSentFlag' in updates) payload.payment_sent_flag = updates.PaymentSentFlag;
    if ('PaymentReference' in updates) payload.payment_reference = updates.PaymentReference;
    if ('PaymentProofLink' in updates) payload.payment_proof_link = updates.PaymentProofLink;
    if ('PaymentVerifiedBy' in updates) payload.payment_verified_by = updates.PaymentVerifiedBy;
    if ('OverdueFlag' in updates) payload.overdue_flag = updates.OverdueFlag;
    if ('GSTAmount' in updates) payload.gst_amount = updates.GSTAmount;
    if ('TotalAmount' in updates) payload.total_amount = updates.TotalAmount;
    if ('AccountsRemarks' in updates) payload.accounts_remarks = updates.AccountsRemarks;
    if ('VerificationDate' in updates) payload.verification_date = updates.VerificationDate;

    const { error } = await supabase.from('accounts').update(payload).eq('ord_id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Account not found' });
      throw error;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('accounts').delete().eq('ord_id', id).select().single();
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ISSUES ENDPOINTS ---
app.get('/api/issues', authenticateToken, async (req, res) => {
  try {
    const { data: issues, error } = await supabase.from('issues').select('*');
    if (error) throw error;

    const mapped = issues.map(i => ({
      IssueID: i.issue_id,
      OrdID: i.ord_id,
      IssueDate: i.issue_date,
      ReportedBy: i.reported_by,
      IssueDescription: i.issue_description,
      PhotoLinks: i.photo_links,
      Status: i.status,
      ResolutionNotes: i.resolution_notes
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/issues', authenticateToken, async (req, res) => {
  try {
    const newIssue = {
      issue_id: `ISS-${Math.floor(1000 + Math.random() * 9000)}`,
      ord_id: req.body.OrdID,
      issue_date: req.body.IssueDate || new Date().toISOString(),
      reported_by: req.body.ReportedBy,
      issue_description: req.body.IssueDescription,
      photo_links: req.body.PhotoLinks || '[]',
      status: req.body.Status || 'Open',
      resolution_notes: req.body.ResolutionNotes || ''
    };

    const { error } = await supabase.from('issues').insert([newIssue]).select().single();
    if (error) throw error;


    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/issues/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const payload = {};
    if ('Status' in updates) payload.status = updates.Status;
    if ('ResolutionNotes' in updates) payload.resolution_notes = updates.ResolutionNotes;
    if ('PhotoLinks' in updates) payload.photo_links = updates.PhotoLinks;

    const { error } = await supabase.from('issues').update(payload).eq('issue_id', id).select().single();
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/issues/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('issues').delete().eq('issue_id', id).select().single();
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DEBIT NOTES ENDPOINTS ---
app.get('/api/debit-notes', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('debit_notes').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/debit-notes', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('debit_notes').insert([req.body]).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- ADDRESSES ENDPOINTS ---
app.get('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('addresses').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('addresses').insert([req.body]).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate disputes endpoint removed


// --- SALES APPROVALS ENDPOINTS ---
app.get('/api/sales-approvals', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('sales_approvals').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/sales-approvals', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('sales_approvals').insert([req.body]).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUSH NOTIFICATION (UNCHANGED LOGIC)
app.post('/api/push/subscribe', authenticateToken, async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription) return res.status(400).json({ error: 'Missing data' });

    const { data: userRow, error } = await supabase.from('profiles').select('*').eq('user_id', userId).single();

    if (error || !userRow) {
      console.log(`[PUSH] User ${userId} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    let subs = userRow.push_subscriptions || [];

    // Check if sub already exists based on endpoint
    const exists = subs.find(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      subs.push(subscription);
      const { error: updateErr } = await supabase.from('profiles').update({ push_subscriptions: subs }).eq('user_id', userId).select().single();
      if (updateErr) throw updateErr;

      // Sync to sheets

    }


    res.json({ success: true });
  } catch (err) {
    console.error('Push Subscribe Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/expo-token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('user_id', req.user.user_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SSE REALTIME HUB ---
const sseClients = new Set();
app.get('/api/realtime', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// Subscribe to ALL Postgres changes and broadcast via SSE
// Security Fix: Do not send row payloads to prevent data leakage. Only send table name.
supabase.channel('global-db-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
    const msg = `data: ${JSON.stringify({ table: payload.table })}\n\n`;
    sseClients.forEach(c => c.write(msg));
  })
  .subscribe();

// --- NOTIFICATION PROXIES ---
app.get('/api/notifications/history', authenticateToken, async (req, res) => {
  try {
    let targetRole = (req.user.role || '').toLowerCase();
    if (targetRole === 'customer') targetRole = 'retailer';
    const userId = (req.user.user_id || req.user.UserID || '').toLowerCase();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`target_role.ilike.${targetRole},target_role.ilike.${userId}`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/clear', authenticateToken, async (req, res) => {
  try {
    let targetRole = (req.user.role || '').toLowerCase();
    if (targetRole === 'customer') targetRole = 'retailer';
    const userId = (req.user.user_id || req.user.UserID || '').toLowerCase();

    const { error } = await supabase
      .from('notifications')
      .delete()
      .or(`target_role.eq.${targetRole},target_role.eq.${userId}`);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/read', authenticateToken, async (req, res) => {
  try {
    let targetRole = (req.user.role || '').toLowerCase();
    if (targetRole === 'customer') targetRole = 'retailer';
    const userId = (req.user.user_id || req.user.UserID || '').toLowerCase();

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .or(`target_role.eq.${targetRole},target_role.eq.${userId}`)
      .eq('is_read', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/send', authenticateToken, async (req, res) => {
  try {
    const { targets, title, message } = req.body;

    // Insert persistent notifications into the database
    const notificationsToInsert = targets.map(target => ({
      target_role: target.toLowerCase(),
      title: title,
      message: message
    }));
    const { error: insertError } = await supabase.from('notifications').insert(notificationsToInsert);
    if (insertError) {
      console.error('Push notification insert error:', insertError);
    }

    const { data: users, error } = await supabase.from('profiles').select('user_id, role, push_subscriptions, expo_push_token');
    if (error) throw error;

    const lowerTargets = targets.map(t => typeof t === 'string' ? t.toLowerCase() : String(t).toLowerCase());

    const targetUsers = users.filter(u => {
      const roleStr = String(u.role || '').toLowerCase();
      const mappedRole = roleStr === 'customer' ? 'retailer' : roleStr;
      const userIdStr = String(u.user_id || '').toLowerCase();
      
      return lowerTargets.includes(mappedRole) ||
             lowerTargets.includes(roleStr) ||
             lowerTargets.includes(userIdStr) ||
             targets.includes(u.user_id);
    });

    let sendCount = 0;
    const pushPromises = [];

    for (const user of targetUsers) {
      if (user.push_subscriptions && Array.isArray(user.push_subscriptions)) {
        for (const sub of user.push_subscriptions) {
          pushPromises.push(webpush.sendNotification(sub, JSON.stringify({ title, message })).catch(_e => { }));
          sendCount++;
        }
      }
      if (user.expo_push_token) {
        pushPromises.push(
          fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: user.expo_push_token,
              sound: 'default',
              title: title,
              body: message
            })
          }).catch(_e => { })
        );
        sendCount++;
      }
    }
    await Promise.all(pushPromises);
    res.json({ success: true, sent: sendCount });
  } catch (err) {
    require('fs').appendFileSync('error_log.txt', new Date().toISOString() + ' - push/send error: ' + err.message + '\n');
    console.error('Push Send Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- DEBIT NOTES SWEEP ---
app.post('/api/debit-notes/sweep', authenticateToken, async (req, res) => {
  try {
    const { data: custRows } = await supabase.from('profiles').select('*');
    const { data: acctRows } = await supabase.from('accounts').select('*');
    const { data: ordRows } = await supabase.from('orders').select('*');

    let penaltyCount = 0;
    const penaltyAmount = 500; // Flat penalty

    for (const cust of custRows) {
      if (cust.role !== 'customer' && cust.role !== 'dealer') continue;

      const allowedDays = parseInt(cust.allowed_payment_days || 21);
      const userOrders = ordRows.filter(r => r.user_id === cust.user_id).map(r => r.ord_id);
      const userInvoices = acctRows.filter(r => userOrders.includes(r.ord_id));

      let isOverdue = false;
      for (const inv of userInvoices) {
        if (inv.payment_due_date && inv.payment_sent_flag !== true) {
          const due = new Date(inv.payment_due_date);
          const invoiceDate = new Date(due.getTime() - 15 * 24 * 60 * 60 * 1000);
          const diff = Math.max(0, Math.floor((Date.now() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)));
          if (diff > allowedDays) {
            isOverdue = true;
            break;
          }
        }
      }

      if (isOverdue) {
        // Issue Debit Note in Supabase
        await supabase.from('debit_notes').insert([{
          note_id: 'DN-' + Date.now().toString().slice(-6) + penaltyCount,
          user_id: cust.user_id,
          date: new Date().toISOString().split('T')[0],
          amount: penaltyAmount,
          reason: 'Overdue invoice beyond allowed days',
          status: 'Active'
        }]);

        penaltyCount++;
      }
    }

    res.json({ success: true, count: penaltyCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to issue debit notes', details: err.message });
  }
});

// --- CHALLANS ENDPOINTS ---
app.get('/api/challans', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('challans').select('*');
    if (error) throw error;
    res.json(data.map(r => ({ ChallanID: r.challan_id, UserID: r.user_id, Date: r.date, Depot: r.depot, Grade: r.grade, QuantityDeposited: r.quantity_deposited })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch challans', details: err.message });
  }
});

app.post('/api/challans', authenticateToken, async (req, res) => {
  try {
    const { UserID, Date: challanDate, Depot, Grade, QuantityDeposited } = req.body;
    const payload = {
      challan_id: 'CHL-' + Date.now().toString().slice(-6),
      user_id: UserID,
      date: challanDate,
      depot: Depot,
      grade: Grade,
      quantity_deposited: QuantityDeposited
    };

    const { data, error } = await supabase.from('challans').insert([payload]).select().single();
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create challan', details: err.message });
  }
});

// --- ADDRESS BOOK ENDPOINTS ---
app.get('/api/addresses/:userId', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('addresses').select('*').eq('user_id', req.params.userId);
    if (error) throw error;
    res.json(data.map(r => ({ AddressID: r.address_id, UserID: r.user_id, Address: r.address, City: r.city, Phone: r.phone, Name: r.name })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const newAddrId = `ADDR-${Date.now()}`;
    const { error } = await supabase.from('addresses').insert([{
      address_id: newAddrId,
      user_id: req.body.UserID,
      address: req.body.Address,
      city: req.body.City,
      phone: req.body.Phone,
      name: req.body.Name
    }]);
    if (error) throw error;
    res.json({ success: true, address: { AddressID: newAddrId, ...req.body } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DISPUTES ENDPOINTS ---
app.post('/api/disputes', authenticateToken, async (req, res) => {
  try {
    const disputeId = `DISP-${Date.now()}`;
    const { error } = await supabase.from('disputes').insert([{
      dispute_id: disputeId,
      ord_id: req.body.OrdID,
      user_id: req.body.UserID,
      issue_type: req.body.IssueType,
      damaged_quantity: req.body.DamagedQuantity,
      photo_url: req.body.PhotoURL,
      status: 'Pending',
      admin_notes: req.body.AdminNotes
    }]);
    if (error) throw error;

    const msg = `data: ${JSON.stringify({ table: 'disputes', payload: { eventType: 'INSERT' } })}\n\n`;
    sseClients.forEach(c => c.write(msg));

    res.json({ success: true, dispute: { DisputeID: disputeId, Status: 'Pending', ...req.body } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/disputes', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('disputes').select('*');

    if (req.user.role === 'customer') {
      query = query.eq('user_id', req.user.user_id);
    }

    const { data: disputes, error } = await query;
    if (error) throw error;

    // We will do Sales Rep filtering on the frontend (or here if we prefer, but frontend is easier since we already fetch all users to join)
    const mapped = (disputes || []).map(d => ({
      DisputeID: d.dispute_id || d.DisputeID,
      OrdID: d.ord_id || d.OrdID,
      UserID: d.user_id || d.UserID,
      IssueType: d.issue_type || d.IssueType,
      DamagedQuantity: d.damaged_quantity || d.DamagedQuantity,
      PhotoURL: d.photo_url || d.PhotoURL,
      Status: d.status || d.Status,
      AdminNotes: d.admin_notes || d.AdminNotes,
      CreatedAt: d.created_at || d.CreatedAt || d.created_at
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/disputes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const payload = {};
    if ('Status' in updates) payload.status = updates.Status;
    if ('AdminNotes' in updates) payload.admin_notes = updates.AdminNotes;

    const { error } = await supabase.from('disputes').update(payload).eq('dispute_id', id).select().single();
    if (error) throw error;

    const msg = `data: ${JSON.stringify({ table: 'disputes', payload: { eventType: 'UPDATE' } })}\n\n`;
    sseClients.forEach(c => c.write(msg));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CUSTOMER ADMIN ENDPOINTS ---
app.patch('/api/customers/:id/limits', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      CreditLimit, AllowedPaymentDays, Segment, ManualUnlock, NonTradeActivated,
      OutstandingAmount, Bkt0_1, Bkt2_4, Bkt5_5, Bkt6_7, Bkt8_15, Bkt16_20, Bkt21_Above
    } = req.body;

    const payload = {};
    if (CreditLimit !== undefined) payload.credit_limit = CreditLimit;
    if (AllowedPaymentDays !== undefined) payload.allowed_payment_days = AllowedPaymentDays;
    if (Segment !== undefined) payload.segment = Segment;
    if (ManualUnlock !== undefined) payload.manual_unlock = ManualUnlock;
    if (NonTradeActivated !== undefined) payload.non_trade_activated = NonTradeActivated;

    if (OutstandingAmount !== undefined) payload.outstanding_amount = OutstandingAmount;
    if (Bkt0_1 !== undefined) payload.bkt_0_1 = Bkt0_1;
    if (Bkt2_4 !== undefined) payload.bkt_2_4 = Bkt2_4;
    if (Bkt5_5 !== undefined) payload.bkt_5_5 = Bkt5_5;
    if (Bkt6_7 !== undefined) payload.bkt_6_7 = Bkt6_7;
    if (Bkt8_15 !== undefined) payload.bkt_8_15 = Bkt8_15;
    if (Bkt16_20 !== undefined) payload.bkt_16_20 = Bkt16_20;
    if (Bkt21_Above !== undefined) payload.bkt_21_above = Bkt21_Above;

    const { error } = await supabase.from('profiles').update(payload).eq('user_id', id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers/:id/adjustments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustments, reason } = req.body;

    // adjustments is an array of { bucket: 'DAY_1', amount: 500 }
    if (!adjustments || !Array.isArray(adjustments) || !reason) {
      return res.status(400).json({ error: 'Missing adjustments array or reason' });
    }

    const payload = adjustments.map(adj => ({
      user_id: id,
      bucket_name: adj.bucket,
      amount: adj.amount,
      reason
    }));

    const { error } = await supabase.from('bucket_adjustments').insert(payload);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/outstanding-notes', authenticateToken, async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'accountant') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('bucket_adjustments')
      .select('adjustment_id, amount, reason, created_at, profiles(company, name, user_id)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers/:id/payments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (req.user && !['admin', 'accountant', 'sales'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins, accountants, and sales can record payments' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const { data, error } = await supabase.rpc('record_payment_fifo', {
      p_user_id: id,
      p_amount: amount,
      p_recorded_by: req.user ? req.user.user_id : 'unknown'
    });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REPORTS EXPORT ENDPOINT ---
app.post('/api/reports/export', authenticateToken, async (req, res) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/dummy/edit`;
    res.json({ success: true, url, message: 'Google Sheets export is temporarily disabled pending Supabase migration' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to export report', details: err.message });
  }
});

// --- VISITS ENDPOINTS ---
app.get('/api/visits', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('visits').select('*');

    // Filter to own visits if sales rep
    if (req.user.role === 'sales') {
      query = query.eq('sales_rep_id', req.user.user_id);
    }

    // Check if table exists by doing a silent query
    const { data: visits, error } = await query;
    if (error) {
      if (error.code === '42P01') {
        // relation "visits" does not exist
        return res.json([]);
      }
      throw error;
    }

    res.json(visits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/visits', authenticateToken, async (req, res) => {
  try {
    const newVisit = req.body;

    // Auto populate fields and map to snake_case
    const dbVisit = {
      id: newVisit.id || `VST-${Math.floor(Date.now() / 1000)}`,
      sales_rep_id: req.user.user_id,
      retailer_id: newVisit.retailerId || newVisit.retailer_id,
      retailername: newVisit.retailerName || newVisit.retailername,
      date: newVisit.date,
      remarks: newVisit.remarks,
      timestamp: new Date().toISOString()
    };
    // Try to insert
    const { error } = await supabase.from('visits').insert([dbVisit]);

    if (error) {
      if (error.code === '42P01') {
        return res.status(500).json({ error: 'visits table does not exist in Supabase. Please run database migration.' });
      }
      throw error;
    }

    res.json({ success: true, visit: newVisit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- COMPETITOR INTEL ENDPOINTS ---
app.get('/api/competitor-intel', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('competitor_intel').select('*').order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet
        return res.json([]);
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/competitor-intel', authenticateToken, async (req, res) => {
  try {
    const intelData = {
      sales_rep_id: req.user.user_id,
      sales_rep_name: req.user.name || 'Sales Rep',
      competitor_name: req.body.competitorName,
      rate_per_bag: req.body.ratePerBag,
      notes: req.body.notes,
      photo_data: req.body.photo_data
    };

    const { data, error } = await supabase.from('competitor_intel').insert([intelData]).select().single();
    if (error) throw error;

    // Notify Admin
    const notification = {
      target_role: 'admin',
      type: 'Competitor Intel',
      title: 'New Competitor Intel Logged',
      message: `${intelData.sales_rep_name} logged new intel for ${intelData.competitor_name} at ₹${intelData.rate_per_bag}/bag.`,
      is_read: false,
      created_at: new Date().toISOString()
    };
    await supabase.from('notifications').insert([notification]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- ZONE RATES ENDPOINTS ---
app.post('/api/admin/zone-rates', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { rates, type } = req.body;
    if (!rates || !Array.isArray(rates) || !type) return res.status(400).json({ error: 'Invalid data format or missing type' });

    // Clear existing rates for this specific type (Trade or Non-Trade), but keep the base price!
    await supabase.from('zone_rates').delete().eq('type', type).neq('grade', 'BASE'); 

    const { error } = await supabase.from('zone_rates').insert(rates);
    if (error) throw error;

    res.json({ success: true, count: rates.length });
  } catch (err) {
    console.error('Zone Rates Import Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/base-price', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { price, type } = req.body;
    if (price === undefined || !type) return res.status(400).json({ error: 'Missing price or type' });

    // Clear existing base price for this type
    await supabase.from('zone_rates').delete().eq('type', type).eq('grade', 'BASE'); 

    const { error } = await supabase.from('zone_rates').insert([{
      grade: 'BASE',
      zone: 'Ahmedabad',
      formula: String(price),
      type: type
    }]);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Base Price Update Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/zone-rates/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { formula, is_available } = req.body;
    
    const updatePayload = {};
    if (formula !== undefined) updatePayload.formula = formula;
    if (is_available !== undefined) updatePayload.is_available = is_available;

    const { error } = await supabase.from('zone_rates').update(updatePayload).eq('id', id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Zone Rate Update Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/zone-rates/add-grade', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { grade, type } = req.body;
    
    // Fetch distinct zones for this type to create a row for each zone
    const { data: zones } = await supabase.from('zone_rates').select('zone').eq('type', type).neq('grade', 'BASE');
    const distinctZones = [...new Set(zones?.map(z => z.zone) || ['Saurashtra', 'North Gujarat', 'Ahmedabad & Anand,Kheda', 'Vadodara', 'South Gujarat'])];
    
    const newRates = distinctZones.map(z => ({
      grade: String(grade).trim(),
      zone: z,
      formula: 'X',
      type: type,
      is_available: true
    }));
    
    const { error } = await supabase.from('zone_rates').insert(newRates);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Add Grade Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/zone-rates/grade/:type/:grade', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { type, grade } = req.params;
    
    const { error } = await supabase.from('zone_rates').delete().eq('grade', grade).eq('type', type);
    if (error) throw error;
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete Grade Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/zone-mappings', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('zone_mappings').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/zone-mappings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { mappings } = req.body;
    
    const { error: delError } = await supabase.from('zone_mappings').delete().neq('zone', 'dummy_val_never_match');
    if (delError) throw delError;

    if (mappings && mappings.length > 0) {
      const { error } = await supabase.from('zone_mappings').insert(mappings);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Zone Mapping Update Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/zone-rates', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('zone_rates').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
