<?php
// ============================================================
// Open CLI — API Configuration
// DO NOT commit real credentials. Set these as environment
// variables on the server (cPanel → Environment Variables or
// via .htaccess SetEnv directives in a non-public directory).
// ============================================================

define('DB_HOST',       getenv('OPENCLI_DB_HOST')       ?: 'localhost');
define('DB_NAME',       getenv('OPENCLI_DB_NAME')       ?: 'sql_opencli_myowncloud_tech');
define('DB_USER',       getenv('OPENCLI_DB_USER')       ?: '');
define('DB_PASS',       getenv('OPENCLI_DB_PASS')       ?: '');
define('JWT_SECRET',    getenv('OPENCLI_JWT_SECRET')    ?: bin2hex(random_bytes(32)));
define('STORAGE_ROOT',  getenv('OPENCLI_STORAGE_ROOT')  ?: sys_get_temp_dir() . '/opencli_uploads');
define('MAIL_FROM',     getenv('OPENCLI_MAIL_FROM')     ?: 'noreply@opencli.myowncloud.tech');
define('MAX_QUOTA_BYTES', 536870912); // 512MB

// OTP / token settings
define('OTP_EXPIRY_MINUTES', 15);
define('JWT_EXPIRY_SECONDS', 60 * 60 * 24 * 30); // 30 days

// Quota: 512 MB per user by default
define('DEFAULT_QUOTA_BYTES', MAX_QUOTA_BYTES);
