CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY,
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 100),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0 AND amount <= 999999999),
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Software','Marketing','Travel','Office','Other')),
  status TEXT NOT NULL CHECK (status IN ('Paid','Pending')),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date DESC);
CREATE TABLE IF NOT EXISTS budgets (
  category TEXT PRIMARY KEY CHECK (category IN ('Software','Marketing','Travel','Office','Other')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0 AND amount <= 999999999),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS income (
  id UUID PRIMARY KEY,
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 100),
  source TEXT NOT NULL CHECK (length(trim(source)) BETWEEN 1 AND 100),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0 AND amount <= 999999999),
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Salary','Freelance','Business','Investments','Other')),
  status TEXT NOT NULL CHECK (status IN ('Received','Expected')),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS income_date_idx ON income (date DESC);
ALTER TABLE income ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'once' CHECK (frequency IN ('once','monthly','twice_monthly','daily','weekly'));
ALTER TABLE income ADD COLUMN IF NOT EXISTS pay_day_1 SMALLINT CHECK (pay_day_1 BETWEEN 1 AND 31);
ALTER TABLE income ADD COLUMN IF NOT EXISTS pay_day_2 SMALLINT CHECK (pay_day_2 BETWEEN 1 AND 31);
ALTER TABLE income ADD COLUMN IF NOT EXISTS pay_weekday SMALLINT CHECK (pay_weekday BETWEEN 0 AND 6);
ALTER TABLE income DROP CONSTRAINT IF EXISTS income_frequency_check;
ALTER TABLE income ADD CONSTRAINT income_frequency_check CHECK (frequency IN ('once','monthly','twice_monthly','daily','weekly'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'ready' CHECK (stage IN ('draft','ready','paid'));
