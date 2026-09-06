-- Run the duplicate check first. Do not add the unique index until this returns no rows.
SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*) AS account_count
FROM users
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1;

-- Resolve any duplicate accounts with a reviewed, customer-safe data migration.
-- Never silently delete production users to make this migration pass.

ALTER TABLE users
  ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  ADD COLUMN deleted_at DATETIME NULL,
  ADD COLUMN token_version INT NOT NULL DEFAULT 0;

-- This relies on the existing users.email collation being case-insensitive.
-- If it is not, convert it to an appropriate utf8mb4 case-insensitive collation first.
ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email);

CREATE TABLE email_verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_verification_token_hash (token_hash),
  INDEX idx_email_verification_user (user_id),
  CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_token_hash (token_hash),
  INDEX idx_password_reset_user (user_id),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE messages
  ADD COLUMN deleted_at DATETIME NULL,
  ADD INDEX idx_messages_chat_deleted (chatId, deleted_at);

CREATE TABLE feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('bug', 'feature', 'problem', 'general') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('new', 'reviewing', 'in_progress', 'resolved', 'rejected') NOT NULL DEFAULT 'new',
  admin_reply TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_feedback_user_created (user_id, created_at),
  INDEX idx_feedback_status_type (status, type),
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- After deployment, review whether legacy accounts should be marked verified:
-- UPDATE users SET email_verified = 1 WHERE ...reviewed business rule...;
