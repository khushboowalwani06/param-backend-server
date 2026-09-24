DO $ $ 
DECLARE
  v_cust_id text;
  v_sales_id text;
BEGIN
  SELECT user_id INTO v_cust_id FROM profiles WHERE role = 'customer' LIMIT 1;
  SELECT user_id INTO v_sales_id FROM profiles WHERE role = 'sales' LIMIT 1;
  IF v_cust_id IS NULL THEN
    v_cust_id := 'USR-DUMMYCUST';
    INSERT INTO profiles (user_id, role, name, company) VALUES (v_cust_id, 'customer', 'Test Customer', 'Test Corp');
  END IF;
  IF v_sales_id IS NULL THEN
    v_sales_id := 'USR-DUMMYSALES';
    INSERT INTO profiles (user_id, role, name, company) VALUES (v_sales_id, 'sales', 'Test Sales Rep', 'Sales Team');
  END IF;
  INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, unit, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES ('ORD-1001', v_cust_id, 'Test Customer', 'Test Corp', 'PPC Cement', 100, 'Bags', 35000, 'Pending Admin Approval', v_sales_id, now() - interval '1 hour') ON CONFLICT DO NOTHING;
  INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, unit, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES ('ORD-1002', v_cust_id, 'Test Customer', 'Test Corp', 'OPC 43 Grade', 500, 'Bags', 175000, 'Pending Admin Approval', v_sales_id, now() - interval '2 hours') ON CONFLICT DO NOTHING;
  INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, unit, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES ('ORD-1003', v_cust_id, 'Test Customer', 'Test Corp', 'PPC Cement', 200, 'Bags', 70000, 'Dispatched', v_sales_id, now() - interval '1 day') ON CONFLICT DO NOTHING;
  INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, unit, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES ('ORD-1004', v_cust_id, 'Test Customer', 'Test Corp', 'OPC 53 Grade', 300, 'Bags', 110000, 'Closed', v_sales_id, now() - interval '3 days') ON CONFLICT DO NOTHING;
  INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, unit, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES ('ORD-1005', v_cust_id, 'Test Customer', 'Test Corp', 'PPC Cement', 150, 'Bags', 52500, 'Overdue', v_sales_id, now() - interval '20 days') ON CONFLICT DO NOTHING;
END $ $;
