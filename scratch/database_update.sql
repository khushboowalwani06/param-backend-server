ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'Approved',
ADD COLUMN IF NOT EXISTS document_aadhar TEXT,
ADD COLUMN IF NOT EXISTS document_pan TEXT,
ADD COLUMN IF NOT EXISTS document_gst TEXT,
ADD COLUMN IF NOT EXISTS document_company_pan TEXT,
ADD COLUMN IF NOT EXISTS document_bank_cheque TEXT,
ADD COLUMN IF NOT EXISTS bkt_0_1 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bkt_2_4 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bkt_5_5 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bkt_6_7 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bkt_8_15 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bkt_16_20 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bkt_21_above NUMERIC DEFAULT 0;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS accounts_remarks TEXT,
ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- CUSTOMER AGEING TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(user_id) ON DELETE CASCADE,
  ord_id TEXT REFERENCES orders(ord_id) ON DELETE CASCADE,
  note_id TEXT REFERENCES debit_notes(note_id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  recorded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for now" ON payments;
CREATE POLICY "Allow all access for now" ON payments FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS bucket_adjustments (
  adjustment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(user_id) ON DELETE CASCADE,
  bucket_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE bucket_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for now" ON bucket_adjustments;
CREATE POLICY "Allow all access for now" ON bucket_adjustments FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION record_payment_fifo(p_user_id TEXT, p_amount NUMERIC, p_recorded_by TEXT)
RETURNS json AS $$
DECLARE
    v_remaining NUMERIC := p_amount;
    v_item RECORD;
    v_total_outstanding NUMERIC := 0;
    v_payment_amount NUMERIC;
BEGIN
    -- Calculate total outstanding
    SELECT COALESCE(SUM(amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.ord_id = c.ord_id OR p.note_id = c.note_id), 0)), 0)
    INTO v_total_outstanding
    FROM (
        SELECT ord_id, NULL as note_id, estimate_amt as amount FROM orders WHERE user_id = p_user_id AND approval_status NOT IN ('Sales Rejected', 'Admin Rejected')
        UNION ALL
        SELECT NULL as ord_id, note_id, amount FROM debit_notes WHERE user_id = p_user_id AND status = 'Active'
    ) c;
    
    IF p_amount > v_total_outstanding THEN
        RAISE EXCEPTION 'Payment exceeds total outstanding amount';
    END IF;

    FOR v_item IN 
        SELECT ord_id, note_id, amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.ord_id = c.ord_id OR p.note_id = c.note_id), 0) AS outstanding
        FROM (
            SELECT ord_id, NULL as note_id, estimate_amt as amount, order_timestamp as ts FROM orders WHERE user_id = p_user_id AND approval_status NOT IN ('Sales Rejected', 'Admin Rejected')
            UNION ALL
            SELECT NULL as ord_id, note_id, amount, created_at as ts FROM debit_notes WHERE user_id = p_user_id AND status = 'Active'
        ) c
        ORDER BY ts ASC
    LOOP
        IF v_remaining <= 0 THEN
            EXIT;
        END IF;

        IF v_item.outstanding > 0 THEN
            IF v_remaining >= v_item.outstanding THEN
                v_payment_amount := v_item.outstanding;
            ELSE
                v_payment_amount := v_remaining;
            END IF;

            INSERT INTO payments (user_id, ord_id, note_id, amount, recorded_by)
            VALUES (p_user_id, v_item.ord_id, v_item.note_id, v_payment_amount, p_recorded_by);

            v_remaining := v_remaining - v_payment_amount;
        END IF;
    END LOOP;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_customer_ageing(p_user_id TEXT)
RETURNS json AS $$
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
            SELECT ord_id, NULL as note_id, estimate_amt as amount, order_timestamp::timestamptz as ts FROM orders WHERE user_id = p_user_id AND (approval_status IS NULL OR approval_status NOT IN ('Sales Rejected', 'Admin Rejected'))
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
$$ LANGUAGE plpgsql;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS audio_data TEXT;

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  sales_rep_id TEXT NOT NULL,
  retailer_id TEXT NOT NULL,
  retailerName TEXT NOT NULL,
  date TEXT NOT NULL,
  remarks TEXT,
  timestamp TEXT NOT NULL
);

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT '{"targets": [{"id": 1, "target": 150, "rewardName": "Silver Tier Trip", "rewardImage": "Gift", "color": "#94a3b8"}, {"id": 2, "target": 280, "rewardName": "Gold Tier Trip (Dubai)", "rewardImage": "Trophy", "color": "#fbbf24"}]}';

CREATE OR REPLACE FUNCTION get_all_customers_ageing()
RETURNS TABLE (
    user_id TEXT,
    outstanding NUMERIC,
    bkt_0_1 NUMERIC,
    bkt_2_4 NUMERIC,
    bkt_5_5 NUMERIC,
    bkt_6_7 NUMERIC,
    bkt_8_15 NUMERIC,
    bkt_16_20 NUMERIC,
    bkt_21_above NUMERIC
) AS $$
DECLARE
    v_user RECORD;
    v_ageing_json json;
BEGIN
    FOR v_user IN SELECT p.user_id FROM profiles p WHERE p.role IN ('customer', 'dealer') LOOP
        v_ageing_json := get_customer_ageing(v_user.user_id);
        
        user_id := v_user.user_id;
        outstanding := COALESCE((v_ageing_json->>'Outstanding')::NUMERIC, 0);
        bkt_0_1 := COALESCE((v_ageing_json->>'DAY_1')::NUMERIC, 0);
        bkt_2_4 := COALESCE((v_ageing_json->>'DAYS_2_4')::NUMERIC, 0);
        bkt_5_5 := COALESCE((v_ageing_json->>'DAY_5')::NUMERIC, 0);
        bkt_6_7 := COALESCE((v_ageing_json->>'DAYS_6_7')::NUMERIC, 0);
        bkt_8_15 := COALESCE((v_ageing_json->>'DAYS_8_15')::NUMERIC, 0);
        bkt_16_20 := COALESCE((v_ageing_json->>'DAYS_16_20')::NUMERIC, 0);
        bkt_21_above := COALESCE((v_ageing_json->>'ABOVE_21')::NUMERIC, 0);
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION place_order_atomic(p_order_data JSONB)
RETURNS json AS $$
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
$$ LANGUAGE plpgsql;


-- Enable Realtime for relevant tables
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE bucket_adjustments;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS customer_id TEXT UNIQUE;
