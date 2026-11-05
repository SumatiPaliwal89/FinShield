CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- DEV-ONLY synthetic credentials. Never do this with real users.
INSERT INTO users(customer_id, username, password_hash) VALUES
  (1, 'alice', crypt('Alice#Dev2026', gen_salt('bf', 10))),
  (2, 'bob',   crypt('Bob#Dev2026',   gen_salt('bf', 10))),
  (3, 'carol', crypt('Carol#Dev2026', gen_salt('bf', 10)));

INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE r.name = 'CUSTOMER';