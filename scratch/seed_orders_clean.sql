INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES 
('ORD-1001', 'USR-B7VBIOUD', 'Customer User', 'Test Corp', 'PPC Cement', 100, 35000, 'Pending Admin Approval', 'USR-Y59EZK7F', now() - interval '1 hour') ON CONFLICT DO NOTHING;
INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES 
('ORD-1002', 'USR-B7VBIOUD', 'Customer User', 'Test Corp', 'OPC 43 Grade', 500, 175000, 'Pending Admin Approval', 'USR-Y59EZK7F', now() - interval '2 hours') ON CONFLICT DO NOTHING;
INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES 
('ORD-1003', 'USR-B7VBIOUD', 'Customer User', 'Test Corp', 'PPC Cement', 200, 70000, 'Dispatched', 'USR-Y59EZK7F', now() - interval '1 day') ON CONFLICT DO NOTHING;
INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, estimate_amt, approval_status, sales_approver_id, order_timestamp) VALUES 
('ORD-1004', 'USR-B7VBIOUD', 'Customer User', 'Test Corp', 'OPC 53 Grade', 300, 110000, 'Closed', 'USR-Y59EZK7F', now() - interval '3 days') ON CONFLICT DO NOTHING;
INSERT INTO orders (ord_id, user_id, name, company, product, estimate_qty, estimate_amt, approval_status, sales_approver_id, order_timestamp, payment_status) VALUES 
('ORD-1005', 'USR-B7VBIOUD', 'Customer User', 'Test Corp', 'PPC Cement', 150, 52500, 'Overdue', 'USR-Y59EZK7F', now() - interval '20 days', 'Unpaid') ON CONFLICT DO NOTHING;
