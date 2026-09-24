-- Exact Supabase Database Schema
-- Generated from production information_schema.columns, pg_proc, and information_schema.triggers

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- TABLES
-- ==========================================

-- 1. Profiles Table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    company TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    push_subscriptions JSONB DEFAULT '[]'::jsonb,
    total_orders_placed INTEGER DEFAULT 0,
    total_orders_closed_on_time INTEGER DEFAULT 0,
    total_orders_overdue INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    segment TEXT,
    credit_limit NUMERIC DEFAULT 0,
    allowed_payment_days INTEGER DEFAULT 21,
    outstanding_amount NUMERIC DEFAULT 0,
    blocked_status BOOLEAN DEFAULT false,
    manual_unlock BOOLEAN DEFAULT false,
    bpid TEXT,
    non_trade_activated BOOLEAN DEFAULT false,
    state TEXT,
    total_orders_pending INTEGER DEFAULT 0,
    bkt_0_1 NUMERIC DEFAULT 0,
    bkt_2_4 NUMERIC DEFAULT 0,
    bkt_5_5 NUMERIC DEFAULT 0,
    bkt_6_7 NUMERIC DEFAULT 0,
    bkt_8_15 NUMERIC DEFAULT 0,
    bkt_16_20 NUMERIC DEFAULT 0,
    bkt_21_above NUMERIC DEFAULT 0,
    assigned_sales_rep TEXT,
    rewards JSONB DEFAULT '{"targets": [{"id": 1, "color": "#94a3b8", "target": 150, "rewardName": "Silver Tier Trip", "rewardImage": "Gift"}, {"id": 2, "color": "#fbbf24", "target": 280, "rewardName": "Gold Tier Trip (Dubai)", "rewardImage": "Trophy"}]}'::jsonb,
    approval_status TEXT DEFAULT 'Approved'::text,
    document_aadhar TEXT,
    document_pan TEXT,
    document_gst TEXT,
    document_company_pan TEXT,
    document_bank_cheque TEXT,
    rejection_reason TEXT,
    expo_push_token TEXT,
    customer_id TEXT,
    tehsil TEXT,
    district TEXT,
    zip_code TEXT,
    zone TEXT
);

-- 2. Orders Table
CREATE TABLE orders (
    ord_id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    company TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    estimate_qty NUMERIC,
    product TEXT,
    estimate_amt NUMERIC,
    project_type TEXT,
    timeline TEXT,
    notes TEXT,
    approval_status TEXT DEFAULT 'Pending Sales Approval'::text,
    sales_approver_id TEXT,
    admin_approver_id TEXT,
    dispatch_status TEXT,
    delivery_confirmed_timestamp TEXT,
    delivery_issue_flag BOOLEAN DEFAULT false,
    invoice_status TEXT,
    order_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    unit_price NUMERIC,
    current_stage TEXT,
    sales_approval_date TIMESTAMP WITH TIME ZONE,
    admin_approval_status TEXT,
    admin_approval_date TIMESTAMP WITH TIME ZONE,
    transport_name TEXT,
    vehicle_number TEXT,
    tracking_number TEXT,
    receiver_name TEXT,
    receiver_contact TEXT,
    delivery_remarks TEXT,
    delivery_status TEXT,
    status TEXT DEFAULT 'Pending'::text,
    customer_id UUID,
    total NUMERIC,
    payment_status TEXT DEFAULT 'Unpaid'::text,
    audio_data TEXT,
    rejection_reason TEXT,
    bag_price NUMERIC,
    ton_price NUMERIC,
    delivery_tehsil TEXT,
    delivery_district TEXT,
    delivery_state TEXT,
    delivery_zip TEXT,
    for_retailer_name TEXT
);

-- 3. Accounts Table
CREATE TABLE accounts (
    ord_id TEXT PRIMARY KEY,
    invoice_number TEXT,
    invoice_pdf_link TEXT,
    final_invoiced_amount NUMERIC,
    payment_due_date TEXT,
    reminder_log JSONB DEFAULT '[]'::jsonb,
    payment_sent_flag BOOLEAN DEFAULT false,
    payment_reference TEXT,
    payment_proof_link TEXT,
    payment_verified_by TEXT,
    overdue_flag BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    gst_amount NUMERIC,
    total_amount NUMERIC,
    accounts_remarks TEXT,
    verification_date TIMESTAMP WITH TIME ZONE
);

-- 4. Addresses Table
CREATE TABLE addresses (
    address_id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    address TEXT,
    city TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Bucket Adjustments Table
CREATE TABLE bucket_adjustments (
    adjustment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    bucket_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Challans Table
CREATE TABLE challans (
    challan_id TEXT PRIMARY KEY,
    user_id TEXT,
    date DATE,
    depot TEXT,
    grade TEXT,
    quantity_deposited NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Competitor Intel Table
CREATE TABLE competitor_intel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_rep_id TEXT NOT NULL,
    sales_rep_name TEXT NOT NULL,
    competitor_name TEXT NOT NULL,
    rate_per_bag NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    photo_data TEXT
);

-- 8. Dealer Retailer Mapping Table
CREATE TABLE dealer_retailer_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id TEXT NOT NULL,
    retailer_name TEXT NOT NULL,
    retailer_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    retailer_city TEXT,
    retailer_tehsil TEXT,
    retailer_district TEXT,
    retailer_state TEXT,
    retailer_zip TEXT
);

-- 9. Debit Notes Table
CREATE TABLE debit_notes (
    note_id TEXT PRIMARY KEY,
    user_id TEXT,
    date DATE,
    amount NUMERIC,
    reason TEXT,
    status TEXT DEFAULT 'Active'::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. Disputes Table
CREATE TABLE disputes (
    dispute_id TEXT PRIMARY KEY,
    ord_id TEXT,
    user_id TEXT,
    issue_type TEXT,
    damaged_quantity NUMERIC,
    photo_url TEXT,
    status TEXT DEFAULT 'Pending'::text,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. Event Participants Table
CREATE TABLE event_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    customer_id TEXT NOT NULL,
    targets JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12. Events Table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    num_targets INTEGER DEFAULT 1 NOT NULL,
    rewards JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 13. Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_role VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 14. Payments Table
CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    ord_id TEXT,
    note_id TEXT,
    amount NUMERIC NOT NULL,
    payment_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    recorded_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 15. Products Table
CREATE TABLE products (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    unit_price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    price NUMERIC,
    quantity INTEGER DEFAULT 0,
    bag_price NUMERIC,
    ton_price NUMERIC,
    grade TEXT
);

-- 16. Sales Approvals Table
CREATE TABLE sales_approvals (
    approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ord_id TEXT,
    sales_approver_id TEXT,
    decision TEXT,
    rejection_reason TEXT,
    customer_credibility TEXT,
    remarks TEXT,
    approval_time TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 17. Users Table
CREATE TABLE users (
    userid TEXT PRIMARY KEY,
    expo_push_token TEXT
);

-- 18. Visits Table
CREATE TABLE visits (
    id TEXT PRIMARY KEY,
    sales_rep_id TEXT NOT NULL,
    retailer_id TEXT NOT NULL,
    retailername TEXT NOT NULL,
    date TEXT NOT NULL,
    remarks TEXT,
    timestamp TEXT NOT NULL
);

-- 19. Zone Mappings Table
CREATE TABLE zone_mappings (
    zone TEXT PRIMARY KEY,
    districts TEXT
);

-- 20. Zone Rates Table
CREATE TABLE zone_rates (
    id SERIAL PRIMARY KEY,
    grade TEXT NOT NULL,
    zone TEXT NOT NULL,
    formula TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    type TEXT DEFAULT 'Trade'::text NOT NULL,
    is_available BOOLEAN DEFAULT true
);

-- Adding some basic Foreign Key constraints
ALTER TABLE orders ADD CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE accounts ADD CONSTRAINT fk_accounts_ord_id FOREIGN KEY (ord_id) REFERENCES orders(ord_id) ON DELETE CASCADE;
ALTER TABLE debit_notes ADD CONSTRAINT fk_debit_notes_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE payments ADD CONSTRAINT fk_payments_ord_id FOREIGN KEY (ord_id) REFERENCES orders(ord_id) ON DELETE SET NULL;
ALTER TABLE payments ADD CONSTRAINT fk_payments_note_id FOREIGN KEY (note_id) REFERENCES debit_notes(note_id) ON DELETE SET NULL;
ALTER TABLE bucket_adjustments ADD CONSTRAINT fk_bucket_adjustments_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
ALTER TABLE addresses ADD CONSTRAINT fk_addresses_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
ALTER TABLE disputes ADD CONSTRAINT fk_disputes_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE disputes ADD CONSTRAINT fk_disputes_ord_id FOREIGN KEY (ord_id) REFERENCES orders(ord_id) ON DELETE SET NULL;
ALTER TABLE challans ADD CONSTRAINT fk_challans_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;


-- ==========================================
-- FUNCTIONS & PROCEDURES
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_customer_ageing(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_credit_limit NUMERIC;
    v_outstanding NUMERIC := 0;
    v_spendable NUMERIC;
    v_bkt_1 NUMERIC := 0;
    v_bkt_2_4 NUMERIC := 0;
    v_bkt_5 NUMERIC := 0;
    v_bkt_6_7 NUMERIC := 0;
    v_bkt_8_15 NUMERIC := 0;
    v_bkt_16_20 NUMERIC := 0;
    v_bkt_21_above NUMERIC := 0;
    v_order RECORD;
    v_age INTEGER;
    v_order_outstanding NUMERIC;
    v_adj RECORD;
BEGIN
    SELECT COALESCE(credit_limit, 0) INTO v_credit_limit FROM profiles WHERE user_id = p_user_id;
    
    FOR v_order IN 
        SELECT amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.ord_id = c.ord_id OR p.note_id = c.note_id), 0) AS outstanding,
               ((now() AT TIME ZONE 'Asia/Kolkata')::date - (ts AT TIME ZONE 'Asia/Kolkata')::date) + 1 AS age
        FROM (
            SELECT o.ord_id, NULL as note_id, o.estimate_amt as amount, 
                   COALESCE(a.payment_due_date::timestamptz, o.order_timestamp::timestamptz) as ts 
            FROM orders o
            LEFT JOIN accounts a ON o.ord_id = a.ord_id
            WHERE o.user_id = p_user_id AND (o.approval_status IS NULL OR o.approval_status NOT IN ('Sales Rejected', 'Admin Rejected', 'Cancelled'))
            UNION ALL
            SELECT NULL as ord_id, note_id, amount, created_at::timestamptz as ts FROM debit_notes WHERE user_id = p_user_id AND status = 'Active'
        ) c
    LOOP
        v_order_outstanding := v_order.outstanding;
        IF v_order_outstanding > 0 THEN
            v_outstanding := v_outstanding + v_order_outstanding;
            v_age := v_order.age;
            IF v_age <= 1 THEN v_bkt_1 := v_bkt_1 + v_order_outstanding;
            ELSIF v_age <= 4 THEN v_bkt_2_4 := v_bkt_2_4 + v_order_outstanding;
            ELSIF v_age = 5 THEN v_bkt_5 := v_bkt_5 + v_order_outstanding;
            ELSIF v_age <= 7 THEN v_bkt_6_7 := v_bkt_6_7 + v_order_outstanding;
            ELSIF v_age <= 15 THEN v_bkt_8_15 := v_bkt_8_15 + v_order_outstanding;
            ELSIF v_age <= 20 THEN v_bkt_16_20 := v_bkt_16_20 + v_order_outstanding;
            ELSE v_bkt_21_above := v_bkt_21_above + v_order_outstanding;
            END IF;
        END IF;
    END LOOP;

    -- Apply bucket adjustments
    FOR v_adj IN SELECT bucket_name, SUM(amount) as amt FROM bucket_adjustments WHERE user_id = p_user_id GROUP BY bucket_name LOOP
        IF v_adj.bucket_name = 'DAY_1' THEN v_bkt_1 := v_bkt_1 + v_adj.amt;
        ELSIF v_adj.bucket_name = 'DAYS_2_4' THEN v_bkt_2_4 := v_bkt_2_4 + v_adj.amt;
        ELSIF v_adj.bucket_name = 'DAY_5' THEN v_bkt_5 := v_bkt_5 + v_adj.amt;
        ELSIF v_adj.bucket_name = 'DAYS_6_7' THEN v_bkt_6_7 := v_bkt_6_7 + v_adj.amt;
        ELSIF v_adj.bucket_name = 'DAYS_8_15' THEN v_bkt_8_15 := v_bkt_8_15 + v_adj.amt;
        ELSIF v_adj.bucket_name = 'DAYS_16_20' THEN v_bkt_16_20 := v_bkt_16_20 + v_adj.amt;
        ELSIF v_adj.bucket_name = 'ABOVE_21' THEN v_bkt_21_above := v_bkt_21_above + v_adj.amt;
        END IF;
        v_outstanding := v_outstanding + v_adj.amt;
    END LOOP;

    v_spendable := v_credit_limit - v_outstanding;

    RETURN json_build_object(
        'Limit', v_credit_limit,
        'Outstanding', v_outstanding,
        'Spendable Amount', v_spendable,
        'DAY_1', v_bkt_1,
        'DAYS_2_4', v_bkt_2_4,
        'DAY_5', v_bkt_5,
        'DAYS_6_7', v_bkt_6_7,
        'DAYS_8_15', v_bkt_8_15,
        'DAYS_16_20', v_bkt_16_20,
        'ABOVE_21', v_bkt_21_above
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_orders_with_payments()
 RETURNS TABLE(ord_id text, user_id text, customer_name text, bpid text, product text, estimate_qty numeric, unit text, estimate_amt numeric, approval_status text, order_timestamp timestamp with time zone, paid_amount numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        o.ord_id,
        o.user_id,
        o.customer_name,
        o.bpid,
        o.product,
        o.estimate_qty,
        o.unit,
        o.estimate_amt,
        o.approval_status,
        o.order_timestamp,
        COALESCE((SELECT SUM(amount) FROM payments p WHERE p.ord_id = o.ord_id), 0) AS paid_amount
    FROM orders o
    ORDER BY o.order_timestamp DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.place_order_atomic(p_order_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user_id TEXT;
    v_segment TEXT;
    v_estimate_amt NUMERIC;
    v_credit_limit NUMERIC;
    v_outstanding NUMERIC;
    v_customer RECORD;
    v_ageing_json json;
    v_bkt_21_above NUMERIC;
    v_order_row orders;
BEGIN
    v_user_id := p_order_data->>'user_id';
    
    -- If no user_id is provided, just insert directly (it's not a Trade customer order with limits)
    IF v_user_id IS NULL THEN
        v_order_row := jsonb_populate_record(null::orders, p_order_data);
        INSERT INTO orders SELECT v_order_row.*;
        RETURN json_build_object('success', true);
    END IF;

    v_segment := p_order_data->>'order_segment';
    v_estimate_amt := COALESCE((p_order_data->>'estimate_amt')::NUMERIC, 0);

    SELECT * INTO v_customer FROM profiles WHERE user_id = v_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    IF v_customer.blocked_status = true AND v_customer.manual_unlock != true THEN
        RAISE EXCEPTION 'Account is blocked manually by admin. Please contact support.';
    END IF;

    v_ageing_json := get_customer_ageing(v_user_id);
    v_outstanding := COALESCE((v_ageing_json->>'Outstanding')::NUMERIC, 0);
    v_bkt_21_above := COALESCE((v_ageing_json->'Buckets'->>'DAY_21_ABOVE')::NUMERIC, 0);

    IF v_bkt_21_above > 0 AND v_customer.manual_unlock != true THEN
        RAISE EXCEPTION 'Account automatically blocked: You have an outstanding balance in the Above 21 Days overdue bucket.';
    END IF;

    IF v_segment = 'Trade' OR v_customer.segment = 'Trade' THEN
        v_credit_limit := COALESCE(v_customer.credit_limit::NUMERIC, 0);
        IF v_outstanding + v_estimate_amt > v_credit_limit THEN
            RAISE EXCEPTION 'Credit limit exceeded. Available headroom: %', (v_credit_limit - v_outstanding);
        END IF;
    END IF;

    v_order_row := jsonb_populate_record(null::orders, p_order_data);
    
    -- Provide fallbacks
    IF v_order_row.company IS NULL AND v_order_row.name IS NULL THEN
        v_order_row.name := COALESCE(v_customer.name, v_customer.company);
        v_order_row.company := COALESCE(v_customer.company, v_customer.name);
    END IF;

    INSERT INTO orders SELECT v_order_row.*;

    RETURN json_build_object('success', true, 'outstanding', v_outstanding);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_update_profile_ageing()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user_id UUID;
    v_ageing_json JSON;
BEGIN
    -- Determine the user_id based on the operation (INSERT, UPDATE, DELETE)
    IF TG_OP = 'DELETE' THEN
        -- Safely attempt to get user_id, if it exists on the table
        BEGIN
            EXECUTE format('SELECT user_id FROM %I WHERE id = $1', TG_TABLE_NAME) USING OLD.id INTO v_user_id;
        EXCEPTION WHEN OTHERS THEN 
            -- Fallback if table doesn't have standard id/user_id structure
            BEGIN
                EXECUTE 'SELECT $1.user_id' USING OLD INTO v_user_id;
            EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
        END;
    ELSE
        BEGIN
            EXECUTE format('SELECT user_id FROM %I WHERE id = $1', TG_TABLE_NAME) USING NEW.id INTO v_user_id;
        EXCEPTION WHEN OTHERS THEN 
            BEGIN
                EXECUTE 'SELECT $1.user_id' USING NEW INTO v_user_id;
            EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
        END;
    END IF;

    -- If we successfully found a user_id for the row being changed
    IF v_user_id IS NOT NULL THEN
        -- Run the live ageing calculation function for this specific user
        v_ageing_json := get_customer_ageing(v_user_id);
        
        -- Immediately update the profiles table with the new live data
        UPDATE profiles
        SET 
            outstanding_amount = COALESCE((v_ageing_json->>'Outstanding')::NUMERIC, 0),
            bkt_0_1 = COALESCE((v_ageing_json->>'DAY_1')::NUMERIC, 0),
            bkt_2_4 = COALESCE((v_ageing_json->>'DAYS_2_4')::NUMERIC, 0),
            bkt_5_5 = COALESCE((v_ageing_json->>'DAY_5')::NUMERIC, 0),
            bkt_6_7 = COALESCE((v_ageing_json->>'DAYS_6_7')::NUMERIC, 0),
            bkt_8_15 = COALESCE((v_ageing_json->>'DAYS_8_15')::NUMERIC, 0),
            bkt_16_20 = COALESCE((v_ageing_json->>'DAYS_16_20')::NUMERIC, 0),
            bkt_21_above = COALESCE((v_ageing_json->>'ABOVE_21')::NUMERIC, 0)
        WHERE user_id = v_user_id;
    END IF;

    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_customers_ageing()
 RETURNS TABLE(user_id text, outstanding numeric, bkt_0_1 numeric, bkt_2_4 numeric, bkt_5_5 numeric, bkt_6_7 numeric, bkt_8_15 numeric, bkt_16_20 numeric, bkt_21_above numeric)
 LANGUAGE sql
AS $function$
    WITH user_orders AS (
        SELECT o.user_id, o.ord_id, NULL as note_id, o.estimate_amt as amount, 
               COALESCE(a.payment_due_date::timestamptz, o.order_timestamp::timestamptz) as ts 
        FROM orders o
        LEFT JOIN accounts a ON o.ord_id = a.ord_id
        WHERE o.approval_status IS NULL OR o.approval_status NOT IN ('Sales Rejected', 'Admin Rejected', 'Cancelled')
        UNION ALL
        SELECT user_id, NULL as ord_id, note_id, amount, created_at::timestamptz as ts 
        FROM debit_notes 
        WHERE status = 'Active'
    ),
    order_balances AS (
        SELECT uo.user_id,
               uo.amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.ord_id = uo.ord_id OR p.note_id = uo.note_id), 0) AS outstanding,
               ((now() AT TIME ZONE 'Asia/Kolkata')::date - (uo.ts AT TIME ZONE 'Asia/Kolkata')::date) + 1 AS age
        FROM user_orders uo
    ),
    raw_buckets AS (
        SELECT user_id,
               SUM(outstanding) as total_outstanding,
               SUM(CASE WHEN age <= 1 THEN outstanding ELSE 0 END) as bkt_0_1,
               SUM(CASE WHEN age >= 2 AND age <= 4 THEN outstanding ELSE 0 END) as bkt_2_4,
               SUM(CASE WHEN age = 5 THEN outstanding ELSE 0 END) as bkt_5_5,
               SUM(CASE WHEN age >= 6 AND age <= 7 THEN outstanding ELSE 0 END) as bkt_6_7,
               SUM(CASE WHEN age >= 8 AND age <= 15 THEN outstanding ELSE 0 END) as bkt_8_15,
               SUM(CASE WHEN age >= 16 AND age <= 20 THEN outstanding ELSE 0 END) as bkt_16_20,
               SUM(CASE WHEN age >= 21 THEN outstanding ELSE 0 END) as bkt_21_above
        FROM order_balances
        WHERE outstanding > 0
        GROUP BY user_id
    ),
    adj_grouped AS (
        SELECT user_id, bucket_name, SUM(amount) as amt
        FROM bucket_adjustments
        GROUP BY user_id, bucket_name
    )
    -- Now join the base profiles with raw buckets and adjustments
    SELECT p.user_id,
           COALESCE(rb.total_outstanding, 0) + COALESCE((SELECT SUM(amt) FROM adj_grouped a WHERE a.user_id = p.user_id), 0) as outstanding,
           COALESCE(rb.bkt_0_1, 0) + COALESCE((SELECT SUM(amt) FROM adj_grouped a WHERE a.user_id = p.user_id AND a.bucket_name = 'DAY_1'), 0) as bkt_0_1,
           COALESCE(rb.bkt_2_4, 0) + COALESCE((SELECT SUM(amt) FROM adj_grouped a WHERE a.user_id = p.user_id AND a.bucket_name = 'DAYS_2_4'), 0) as bkt_2_4,
           COALESCE(rb.bkt_5_5, 0) + COALESCE((SELECT SUM(amt) FROM adj_grouped a WHERE a.user_id = p.user_id AND a.bucket_name = 'DAY_5'), 0) as bkt_5_5,
           COALESCE(rb.bkt_6_7, 0) + COALESCE((SELECT SUM(amt) FROM adj_grouped a WHERE a.user_id = p.user_id AND a.bucket_name = 'DAYS_6_7'), 0) as bkt_6_7,
           COALESCE(rb.bkt_8_15, 0) + COALESCE((SELECT SUM(amt) FROM adj_grouped a WHERE a.user_id = p.user_id AND a.bucket_name = 'DAYS_8_15'), 0) as bkt_8_15,
           COALESCE(rb.bkt_16_20, 0) + COALESCE((SELECT SUM(amt) FROM adj_grouped a WHERE a.user_id = p.user_id AND a.bucket_name = 'DAYS_16_20'), 0) as bkt_16_20,
           COALESCE(rb.bkt_21_above, 0) + COALESCE((SELECT SUM(amt) FROM adj_grouped a WHERE a.user_id = p.user_id AND a.bucket_name = 'ABOVE_21'), 0) as bkt_21_above
    FROM profiles p
    LEFT JOIN raw_buckets rb ON p.user_id = rb.user_id
    WHERE p.role IN ('customer', 'dealer', 'retailer');
$function$;

CREATE OR REPLACE FUNCTION public.record_payment_fifo(p_user_id text, p_amount numeric, p_recorded_by text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_remaining numeric := p_amount;
    v_order record;
    v_pay_amt numeric;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- Iterate through unpaid orders (FIFO)
    FOR v_order IN 
        SELECT c.ord_id, c.note_id, c.outstanding
        FROM (
            SELECT o.ord_id, NULL as note_id, 
                   o.estimate_amt - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.ord_id = o.ord_id), 0) AS outstanding,
                   COALESCE(a.payment_due_date::timestamptz, o.order_timestamp::timestamptz) as ts 
            FROM orders o
            LEFT JOIN accounts a ON o.ord_id = a.ord_id
            WHERE o.user_id = p_user_id AND (o.approval_status IS NULL OR o.approval_status NOT IN ('Sales Rejected', 'Admin Rejected', 'Cancelled'))
            
            UNION ALL
            
            SELECT NULL as ord_id, dn.note_id, 
                   dn.amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.note_id = dn.note_id), 0) AS outstanding,
                   dn.created_at::timestamptz as ts 
            FROM debit_notes dn 
            WHERE dn.user_id = p_user_id AND dn.status = 'Active'
        ) c
        WHERE c.outstanding > 0
        ORDER BY c.ts ASC
    LOOP
        IF v_remaining <= 0 THEN
            EXIT;
        END IF;

        IF v_remaining >= v_order.outstanding THEN
            v_pay_amt := v_order.outstanding;
        ELSE
            v_pay_amt := v_remaining;
        END IF;

        -- Record the payment for this order
        INSERT INTO payments (ord_id, note_id, user_id, amount, recorded_by)
        VALUES (v_order.ord_id, v_order.note_id, p_user_id, v_pay_amt, p_recorded_by);

        v_remaining := v_remaining - v_pay_amt;
        
        -- If order is fully paid, update its status
        IF v_order.ord_id IS NOT NULL AND v_order.outstanding = v_pay_amt THEN
            UPDATE orders SET approval_status = 'Closed' WHERE ord_id = v_order.ord_id;
        END IF;
    END LOOP;

    -- If there's still remaining amount, it means the user overpaid or is paying off manual bucket adjustments.
    -- We record this as a negative manual bucket adjustment to balance the books!
    IF v_remaining > 0 THEN
        INSERT INTO bucket_adjustments (user_id, bucket_name, amount, reason, created_at)
        VALUES (p_user_id, 'DAY_1', -v_remaining, 'Overpayment / Offset recorded by ' || p_recorded_by, now());
        
        -- Also insert a standalone payment record so it shows up in history (if it's not a debit note)
        INSERT INTO payments (ord_id, note_id, user_id, amount, recorded_by)
        VALUES (NULL, NULL, p_user_id, v_remaining, p_recorded_by);
    END IF;

    RETURN json_build_object('success', true, 'recorded_amount', p_amount);
END;
$function$;


-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER trg_update_ageing_on_orders
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION trigger_update_profile_ageing();

CREATE TRIGGER trg_update_ageing_on_payments
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION trigger_update_profile_ageing();

CREATE TRIGGER trg_update_ageing_on_adjustments
AFTER INSERT OR UPDATE OR DELETE ON bucket_adjustments
FOR EACH ROW EXECUTE FUNCTION trigger_update_profile_ageing();

CREATE TRIGGER trg_update_ageing_on_debit_notes
AFTER INSERT OR UPDATE OR DELETE ON debit_notes
FOR EACH ROW EXECUTE FUNCTION trigger_update_profile_ageing();
