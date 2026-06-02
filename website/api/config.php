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

// ============================================================
// Shared response helpers used by API endpoints
// ============================================================

function jsonResponse(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    echo json_encode($data);
    exit;
}

function jsonError(string $message, int $status = 400): void {
    jsonResponse(['error' => $message], $status);
}

/**
 * Require a valid Bearer JWT and return the user row from DB.
 * Calls jsonError(401) and exits if not authenticated.
 */
function requireAuth(): array {
    // Handle CORS preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        http_response_code(204);
        exit;
    }

    require_once __DIR__ . '/jwt.php';
    $payload = bearer_auth();
    if (!$payload || empty($payload['id'])) {
        jsonError('Unauthorized', 401);
    }

    require_once __DIR__ . '/db.php';
    $pdo  = db();
    $stmt = $pdo->prepare('SELECT id, email, name as display_name FROM users WHERE id = ?');
    $stmt->execute([$payload['id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        jsonError('Unauthorized', 401);
    }

    // Expose $pdo globally so endpoint files can use it directly
    $GLOBALS['pdo'] = $pdo;

    return $user;
}

/**
 * Generate a signed JWT for a user array with at least 'id' and 'email'.
 */
function generateToken(array $user): string {
    require_once __DIR__ . '/jwt.php';
    return jwt_encode(['id' => $user['id'], 'email' => $user['email']]);
}
