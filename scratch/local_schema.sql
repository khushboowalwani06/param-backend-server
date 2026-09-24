


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_all_customers_ageing"() RETURNS TABLE("user_id" "text", "outstanding" numeric, "bkt_0_1" numeric, "bkt_2_4" numeric, "bkt_5_5" numeric, "bkt_6_7" numeric, "bkt_8_15" numeric, "bkt_16_20" numeric, "bkt_21_above" numeric)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_all_customers_ageing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_ageing"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_customer_ageing"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_orders_with_payments"() RETURNS TABLE("ord_id" "text", "user_id" "text", "customer_name" "text", "bpid" "text", "product" "text", "estimate_qty" numeric, "unit" "text", "estimate_amt" numeric, "approval_status" "text", "order_timestamp" timestamp with time zone, "paid_amount" numeric)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_orders_with_payments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_order_atomic"("p_order_data" "jsonb") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."place_order_atomic"("p_order_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_payment_fifo"("p_user_id" "text", "p_amount" numeric, "p_recorded_by" "text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."record_payment_fifo"("p_user_id" "text", "p_amount" numeric, "p_recorded_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_profile_ageing"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
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
$_$;


ALTER FUNCTION "public"."trigger_update_profile_ageing"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "ord_id" "text" NOT NULL,
    "invoice_number" "text",
    "invoice_pdf_link" "text",
    "final_invoiced_amount" numeric,
    "payment_due_date" "text",
    "reminder_log" "jsonb" DEFAULT '[]'::"jsonb",
    "payment_sent_flag" boolean DEFAULT false,
    "payment_reference" "text",
    "payment_proof_link" "text",
    "payment_verified_by" "text",
    "overdue_flag" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "gst_amount" numeric,
    "total_amount" numeric,
    "accounts_remarks" "text",
    "verification_date" timestamp with time zone
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "address_id" "text" NOT NULL,
    "user_id" "text",
    "name" "text",
    "address" "text",
    "city" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bucket_adjustments" (
    "adjustment_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text",
    "bucket_name" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bucket_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challans" (
    "challan_id" "text" NOT NULL,
    "user_id" "text",
    "date" "date",
    "depot" "text",
    "grade" "text",
    "quantity_deposited" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_intel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sales_rep_id" "text" NOT NULL,
    "sales_rep_name" "text" NOT NULL,
    "competitor_name" "text" NOT NULL,
    "rate_per_bag" numeric NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "photo_data" "text"
);


ALTER TABLE "public"."competitor_intel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dealer_retailer_mapping" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "dealer_id" "text" NOT NULL,
    "retailer_name" "text" NOT NULL,
    "retailer_address" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "retailer_city" "text",
    "retailer_tehsil" "text",
    "retailer_district" "text",
    "retailer_state" "text",
    "retailer_zip" "text"
);


ALTER TABLE "public"."dealer_retailer_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debit_notes" (
    "note_id" "text" NOT NULL,
    "user_id" "text",
    "date" "date",
    "amount" numeric,
    "reason" "text",
    "status" "text" DEFAULT 'Active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debit_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disputes" (
    "dispute_id" "text" NOT NULL,
    "ord_id" "text",
    "user_id" "text",
    "issue_type" "text",
    "damaged_quantity" numeric,
    "photo_url" "text",
    "status" "text" DEFAULT 'Pending'::"text",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."disputes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "customer_id" "text" NOT NULL,
    "targets" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "num_targets" integer DEFAULT 1 NOT NULL,
    "rewards" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_role" character varying NOT NULL,
    "title" character varying NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "ord_id" "text" NOT NULL,
    "user_id" "text",
    "name" "text",
    "company" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "city" "text",
    "estimate_qty" numeric,
    "product" "text",
    "estimate_amt" numeric,
    "project_type" "text",
    "timeline" "text",
    "notes" "text",
    "approval_status" "text" DEFAULT 'Pending Sales Approval'::"text",
    "sales_approver_id" "text",
    "admin_approver_id" "text",
    "dispatch_status" "text",
    "delivery_confirmed_timestamp" "text",
    "delivery_issue_flag" boolean DEFAULT false,
    "invoice_status" "text",
    "order_timestamp" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unit_price" numeric,
    "current_stage" "text",
    "sales_approval_date" timestamp with time zone,
    "admin_approval_status" "text",
    "admin_approval_date" timestamp with time zone,
    "transport_name" "text",
    "vehicle_number" "text",
    "tracking_number" "text",
    "receiver_name" "text",
    "receiver_contact" "text",
    "delivery_remarks" "text",
    "delivery_status" "text",
    "status" "text" DEFAULT 'Pending'::"text",
    "customer_id" "uuid",
    "total" numeric,
    "payment_status" "text" DEFAULT 'Unpaid'::"text",
    "audio_data" "text",
    "rejection_reason" "text",
    "bag_price" numeric,
    "ton_price" numeric,
    "delivery_tehsil" "text",
    "delivery_district" "text",
    "delivery_state" "text",
    "delivery_zip" "text",
    "for_retailer_name" "text",
    "unit" "text"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "payment_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text",
    "ord_id" "text",
    "note_id" "text",
    "amount" numeric NOT NULL,
    "payment_timestamp" timestamp with time zone DEFAULT "now"(),
    "recorded_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "product_id" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "unit_price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price" numeric,
    "quantity" integer DEFAULT 0,
    "bag_price" numeric,
    "ton_price" numeric,
    "grade" "text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "role" "text" NOT NULL,
    "name" "text",
    "company" "text",
    "phone" "text",
    "address" "text",
    "city" "text",
    "push_subscriptions" "jsonb" DEFAULT '[]'::"jsonb",
    "total_orders_placed" integer DEFAULT 0,
    "total_orders_closed_on_time" integer DEFAULT 0,
    "total_orders_overdue" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "segment" "text",
    "credit_limit" numeric DEFAULT 0,
    "allowed_payment_days" integer DEFAULT 21,
    "outstanding_amount" numeric DEFAULT 0,
    "blocked_status" boolean DEFAULT false,
    "manual_unlock" boolean DEFAULT false,
    "bpid" "text",
    "non_trade_activated" boolean DEFAULT false,
    "state" "text",
    "total_orders_pending" integer DEFAULT 0,
    "bkt_0_1" numeric DEFAULT 0,
    "bkt_2_4" numeric DEFAULT 0,
    "bkt_5_5" numeric DEFAULT 0,
    "bkt_6_7" numeric DEFAULT 0,
    "bkt_8_15" numeric DEFAULT 0,
    "bkt_16_20" numeric DEFAULT 0,
    "bkt_21_above" numeric DEFAULT 0,
    "assigned_sales_rep" "text",
    "rewards" "jsonb" DEFAULT '{"targets": [{"id": 1, "color": "#94a3b8", "target": 150, "rewardName": "Silver Tier Trip", "rewardImage": "Gift"}, {"id": 2, "color": "#fbbf24", "target": 280, "rewardName": "Gold Tier Trip (Dubai)", "rewardImage": "Trophy"}]}'::"jsonb",
    "approval_status" "text" DEFAULT 'Approved'::"text",
    "document_aadhar" "text",
    "document_pan" "text",
    "document_gst" "text",
    "document_company_pan" "text",
    "document_bank_cheque" "text",
    "rejection_reason" "text",
    "expo_push_token" "text",
    "customer_id" "text",
    "tehsil" "text",
    "district" "text",
    "zip_code" "text",
    "zone" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_approvals" (
    "approval_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ord_id" "text",
    "sales_approver_id" "text",
    "decision" "text",
    "rejection_reason" "text",
    "customer_credibility" "text",
    "remarks" "text",
    "approval_time" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sales_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "userid" "text" NOT NULL,
    "expo_push_token" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."v_sales_id" (
    "user_id" "text"
);


ALTER TABLE "public"."v_sales_id" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visits" (
    "id" "text" NOT NULL,
    "sales_rep_id" "text" NOT NULL,
    "retailer_id" "text" NOT NULL,
    "retailername" "text" NOT NULL,
    "date" "text" NOT NULL,
    "remarks" "text",
    "timestamp" "text" NOT NULL
);


ALTER TABLE "public"."visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zone_mappings" (
    "zone" "text" NOT NULL,
    "districts" "text"
);


ALTER TABLE "public"."zone_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zone_rates" (
    "id" integer NOT NULL,
    "grade" "text" NOT NULL,
    "zone" "text" NOT NULL,
    "formula" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "type" "text" DEFAULT 'Trade'::"text" NOT NULL,
    "is_available" boolean DEFAULT true
);


ALTER TABLE "public"."zone_rates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."zone_rates_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."zone_rates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."zone_rates_id_seq" OWNED BY "public"."zone_rates"."id";



ALTER TABLE ONLY "public"."zone_rates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."zone_rates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("ord_id");



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("address_id");



ALTER TABLE ONLY "public"."bucket_adjustments"
    ADD CONSTRAINT "bucket_adjustments_pkey" PRIMARY KEY ("adjustment_id");



ALTER TABLE ONLY "public"."challans"
    ADD CONSTRAINT "challans_pkey" PRIMARY KEY ("challan_id");



ALTER TABLE ONLY "public"."competitor_intel"
    ADD CONSTRAINT "competitor_intel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dealer_retailer_mapping"
    ADD CONSTRAINT "dealer_retailer_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debit_notes"
    ADD CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("note_id");



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_pkey" PRIMARY KEY ("dispute_id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("ord_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."sales_approvals"
    ADD CONSTRAINT "sales_approvals_pkey" PRIMARY KEY ("approval_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("userid");



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_mappings"
    ADD CONSTRAINT "zone_mappings_pkey" PRIMARY KEY ("zone");



ALTER TABLE ONLY "public"."zone_rates"
    ADD CONSTRAINT "zone_rates_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "trg_update_ageing_on_adjustments" AFTER INSERT OR DELETE OR UPDATE ON "public"."bucket_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_profile_ageing"();



CREATE OR REPLACE TRIGGER "trg_update_ageing_on_debit_notes" AFTER INSERT OR DELETE OR UPDATE ON "public"."debit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_profile_ageing"();



CREATE OR REPLACE TRIGGER "trg_update_ageing_on_orders" AFTER INSERT OR DELETE OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_profile_ageing"();



CREATE OR REPLACE TRIGGER "trg_update_ageing_on_payments" AFTER INSERT OR DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_profile_ageing"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "fk_accounts_ord_id" FOREIGN KEY ("ord_id") REFERENCES "public"."orders"("ord_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "fk_addresses_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bucket_adjustments"
    ADD CONSTRAINT "fk_bucket_adjustments_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challans"
    ADD CONSTRAINT "fk_challans_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debit_notes"
    ADD CONSTRAINT "fk_debit_notes_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "fk_disputes_ord_id" FOREIGN KEY ("ord_id") REFERENCES "public"."orders"("ord_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "fk_disputes_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "fk_orders_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "fk_payments_note_id" FOREIGN KEY ("note_id") REFERENCES "public"."debit_notes"("note_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "fk_payments_ord_id" FOREIGN KEY ("ord_id") REFERENCES "public"."orders"("ord_id") ON DELETE SET NULL;



CREATE POLICY "Allow all access for now" ON "public"."bucket_adjustments" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all access for now" ON "public"."payments" USING (true) WITH CHECK (true);



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bucket_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitor_intel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dealer_retailer_mapping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debit_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disputes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zone_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zone_rates" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bucket_adjustments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."payments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




























































































































































GRANT ALL ON FUNCTION "public"."get_all_customers_ageing"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_customers_ageing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_customers_ageing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_ageing"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_ageing"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_ageing"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_orders_with_payments"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_orders_with_payments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_orders_with_payments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."place_order_atomic"("p_order_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."place_order_atomic"("p_order_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."place_order_atomic"("p_order_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_payment_fifo"("p_user_id" "text", "p_amount" numeric, "p_recorded_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_payment_fifo"("p_user_id" "text", "p_amount" numeric, "p_recorded_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_payment_fifo"("p_user_id" "text", "p_amount" numeric, "p_recorded_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_profile_ageing"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_profile_ageing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_profile_ageing"() TO "service_role";


















GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON TABLE "public"."bucket_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."bucket_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."bucket_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."challans" TO "anon";
GRANT ALL ON TABLE "public"."challans" TO "authenticated";
GRANT ALL ON TABLE "public"."challans" TO "service_role";



GRANT ALL ON TABLE "public"."competitor_intel" TO "anon";
GRANT ALL ON TABLE "public"."competitor_intel" TO "authenticated";
GRANT ALL ON TABLE "public"."competitor_intel" TO "service_role";



GRANT ALL ON TABLE "public"."dealer_retailer_mapping" TO "anon";
GRANT ALL ON TABLE "public"."dealer_retailer_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."dealer_retailer_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."debit_notes" TO "anon";
GRANT ALL ON TABLE "public"."debit_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."debit_notes" TO "service_role";



GRANT ALL ON TABLE "public"."disputes" TO "anon";
GRANT ALL ON TABLE "public"."disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."disputes" TO "service_role";



GRANT ALL ON TABLE "public"."event_participants" TO "anon";
GRANT ALL ON TABLE "public"."event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sales_approvals" TO "anon";
GRANT ALL ON TABLE "public"."sales_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_sales_id" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_sales_id" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_sales_id" TO "service_role";



GRANT ALL ON TABLE "public"."visits" TO "anon";
GRANT ALL ON TABLE "public"."visits" TO "authenticated";
GRANT ALL ON TABLE "public"."visits" TO "service_role";



GRANT ALL ON TABLE "public"."zone_mappings" TO "anon";
GRANT ALL ON TABLE "public"."zone_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."zone_rates" TO "anon";
GRANT ALL ON TABLE "public"."zone_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_rates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."zone_rates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zone_rates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zone_rates_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";































