-- Public IDs identify resources in the API. Names are display values, not unique identifiers.
CREATE TABLE homes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  CONSTRAINT ck_homes_name CHECK (length(trim(name)) > 0)
);

-- Database-generated ordinals preserve member order without a race-prone MAX(position) + 1.
CREATE TABLE members (
  ordinal INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  CONSTRAINT fk_members_home FOREIGN KEY (home_id) REFERENCES homes(id),
  -- Composite parent keys let shares enforce that the member and bill belong to one home.
  CONSTRAINT uq_members_id_home UNIQUE (id, home_id),
  CONSTRAINT ck_members_name CHECK (length(trim(name)) > 0)
);

-- Persist bill totals once; payments change shares, not the original expense amount.
CREATE TABLE bills (
  ordinal INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  CONSTRAINT fk_bills_home FOREIGN KEY (home_id) REFERENCES homes(id),
  CONSTRAINT uq_bills_id_home UNIQUE (id, home_id),
  CONSTRAINT ck_bills_title CHECK (length(trim(title)) > 0),
  -- SQLite affinity is not strict typing. The upper bound is JavaScript's safe-integer limit.
  CONSTRAINT ck_bills_total_cents CHECK (
    typeof(total_cents) = 'integer'
    AND total_cents BETWEEN 1 AND 9007199254740991
  )
);

-- A share is one member's portion of a bill; payment is recorded directly on this row.
CREATE TABLE shares (
  id TEXT PRIMARY KEY NOT NULL,
  home_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  payment_key TEXT,
  -- Including home_id in both foreign keys rejects cross-home bill/member combinations.
  CONSTRAINT fk_shares_bill_home FOREIGN KEY (bill_id, home_id)
    REFERENCES bills(id, home_id),
  CONSTRAINT fk_shares_member_home FOREIGN KEY (member_id, home_id)
    REFERENCES members(id, home_id),
  -- Prevent duplicate shares; creation code ensures every snapshot member receives one.
  CONSTRAINT uq_shares_bill_member UNIQUE (bill_id, member_id),
  -- Zero-cent shares are valid when there are more members than cents to divide.
  CONSTRAINT ck_shares_amount_cents CHECK (
    typeof(amount_cents) = 'integer'
    AND amount_cents BETWEEN 0 AND 9007199254740991
  ),
  -- Record the timestamp and accepted key together; neither may be present on its own.
  CONSTRAINT ck_shares_payment_state CHECK (
    (paid_at IS NULL AND payment_key IS NULL)
    OR (
      paid_at IS NOT NULL
      AND payment_key IS NOT NULL
      AND length(trim(payment_key)) > 0
    )
  )
);

-- Support ordered home reads and lookups of each member's unpaid shares.
CREATE INDEX idx_members_home_order ON members(home_id, ordinal);
CREATE INDEX idx_bills_home_order ON bills(home_id, ordinal);
CREATE INDEX idx_shares_home_member_paid ON shares(home_id, member_id, paid_at);
