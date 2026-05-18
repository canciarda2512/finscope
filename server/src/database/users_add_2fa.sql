ALTER TABLE finscope.users ADD COLUMN IF NOT EXISTS twoFactorEnabled UInt8 DEFAULT 0;
