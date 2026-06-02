-- ============================================================
-- Open CLI — MySQL Schema
-- Database: sql_opencli_myowncloud_tech
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email               VARCHAR(255)    NOT NULL UNIQUE,
    password_hash       VARCHAR(255)    NOT NULL,
    name                VARCHAR(100)    NOT NULL DEFAULT '',
    is_verified         TINYINT(1)      NOT NULL DEFAULT 0,
    quota_bytes         BIGINT UNSIGNED NOT NULL DEFAULT 536870912, -- 512 MB
    storage_used_bytes  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================

CREATE TABLE IF NOT EXISTS otps (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    otp         CHAR(6)      NOT NULL,
    expires_at  DATETIME     NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_otp (user_id, otp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================

CREATE TABLE IF NOT EXISTS sync_packages (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED    NOT NULL,
    project_hash    CHAR(64)        NOT NULL,          -- sha256 of project path
    project_name    VARCHAR(255)    NOT NULL DEFAULT '',
    device_label    VARCHAR(100)    NOT NULL DEFAULT '',
    file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    synced_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_project (user_id, project_hash),
    INDEX idx_user_synced (user_id, synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================

CREATE TABLE IF NOT EXISTS devices (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED    NOT NULL,
    device_label    VARCHAR(100)    NOT NULL DEFAULT '',
    platform        VARCHAR(50)     NOT NULL DEFAULT '',  -- linux, macos, windows, android
    last_seen_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    registered_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_device (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(100) NOT NULL,
  key_value  VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used  DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_keys (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  device_name VARCHAR(255) DEFAULT NULL,
  ip_address  VARCHAR(45)  DEFAULT NULL,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_sessions (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  action_type VARCHAR(50)  NOT NULL,
  message     VARCHAR(500) DEFAULT NULL,
  device_name VARCHAR(255) DEFAULT NULL,
  ip_address  VARCHAR(45)  DEFAULT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_activity_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snippets table
CREATE TABLE IF NOT EXISTS snippets (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  command    TEXT         NOT NULL,
  tags       VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_snippets_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  url        VARCHAR(500) NOT NULL,
  event      VARCHAR(50)  NOT NULL DEFAULT 'sync',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_webhooks_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feedback table (no FK — allows anonymous feedback)
CREATE TABLE IF NOT EXISTS feedback (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED DEFAULT NULL,
  email      VARCHAR(255) DEFAULT NULL,
  message    TEXT         NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OAuth columns (alter users table)
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark';
ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT 'green';

-- ============================================================
-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limit (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  ip           VARCHAR(45) NOT NULL,
  action       VARCHAR(50) NOT NULL,
  attempts     INT DEFAULT 1,
  window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_ip_action (ip, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Password resets
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(64) UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used       TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Chat history sync
CREATE TABLE IF NOT EXISTS chat_sessions (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       INT NOT NULL,
  project_hash  VARCHAR(64),
  project_name  VARCHAR(255),
  model         VARCHAR(100),
  skill         VARCHAR(100),
  msg_count     INT DEFAULT 0,
  input_tokens  INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  cost_usd      DECIMAL(10,6) DEFAULT 0,
  started_at    DATETIME,
  ended_at      DATETIME,
  synced_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_started (user_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id          VARCHAR(36) PRIMARY KEY,
  session_id  VARCHAR(36) NOT NULL,
  user_id     INT NOT NULL,
  role        ENUM('user','assistant','system','tool') NOT NULL,
  content     MEDIUMTEXT,
  tool_calls  JSON,
  tokens      INT DEFAULT 0,
  created_at  DATETIME,
  synced_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- System announcements
CREATE TABLE IF NOT EXISTS announcements (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  level      ENUM('info','warning','critical') DEFAULT 'info',
  is_active  TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
