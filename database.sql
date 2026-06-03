-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free-trial',
  status TEXT DEFAULT 'active',
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  next_billing_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Search Logs Table
CREATE TABLE IF NOT EXISTS search_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  result_count INTEGER,
  execution_time_ms INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Keys Table (Rotation)
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  key_value TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  rotated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(service, key_value)
);

-- Verified Cases (Case Library)
CREATE TABLE IF NOT EXISTS verified_cases (
  id TEXT PRIMARY KEY,
  gr_number TEXT UNIQUE NOT NULL,
  case_title TEXT NOT NULL,
  date_of_decision TEXT,
  court TEXT,
  codal_provisions TEXT,
  quoted_portion TEXT,
  source_url TEXT,
  full_text TEXT,
  embedding_vector BLOB,
  verified_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Payment Transactions (Monetization)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_php REAL NOT NULL,
  currency TEXT DEFAULT 'PHP',
  payment_method TEXT,
  payment_gateway TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admin Sessions (Dashboard)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for Performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX idx_verified_cases_gr_number ON verified_cases(gr_number);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);