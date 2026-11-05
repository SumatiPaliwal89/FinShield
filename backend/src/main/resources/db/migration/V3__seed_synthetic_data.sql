INSERT INTO customers(full_name, email) VALUES
  ('Alice Synthetic', 'alice@example.test'),
  ('Bob Synthetic',   'bob@example.test'),
  ('Carol Synthetic', 'carol@example.test');

INSERT INTO accounts(customer_id, account_number, balance) VALUES
  (1, 'FS0000000001', 100000.0000),
  (1, 'FS0000000002',  25000.0000),
  (2, 'FS0000000003',  50000.0000),
  (3, 'FS0000000004',  10000.0000);