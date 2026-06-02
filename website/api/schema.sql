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
