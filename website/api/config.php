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
define('JWT_SECRET',    getenv('OPENCLI_JWT_SECRET')    ?: 'change-this-in-production');
define('STORAGE_ROOT',  getenv('OPENCLI_STORAGE_ROOT')  ?: '/home/opencli_user/uploads');
define('MAIL_FROM',     getenv('OPENCLI_MAIL_FROM')     ?: 'noreply@opencli.myowncloud.tech');

// OTP / token settings
define('OTP_EXPIRY_MINUTES', 15);
define('JWT_EXPIRY_SECONDS', 60 * 60 * 24 * 30); // 30 days

// Quota: 500 MB per user by default
define('DEFAULT_QUOTA_BYTES', 500 * 1024 * 1024);
