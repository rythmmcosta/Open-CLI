<?php
// ============================================================
// Open CLI — POST /api/login
// Body: { email, password }
// Returns: { success: true, token: "JWT", user: {...} }
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/rate-limit.php';

$pdo = db();
$ip  = getClientIp();

// Rate limit: 5 login attempts per 15 minutes per IP
checkRateLimit($pdo, $ip, 'login', 5, 15);

$body     = json_decode(file_get_contents('php://input'), true);
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (!$email || !$password) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'email and password are required']);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT id, name, email, password_hash, is_verified, quota_bytes, storage_used_bytes
     FROM users WHERE email = ?'
);
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    recordAttempt($pdo, $ip, 'login');
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
    exit;
}

if (!$user['is_verified']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Email not verified. Check your inbox for the OTP.']);
    exit;
}

// Successful login — clear rate limit
clearAttempts($pdo, $ip, 'login');

$token = jwt_encode(['user_id' => $user['id'], 'email' => $user['email']]);

echo json_encode([
    'success' => true,
    'token'   => $token,
    'user'    => [
        'id'                 => $user['id'],
        'name'               => $user['name'],
        'email'              => $user['email'],
        'quota_bytes'        => (int) $user['quota_bytes'],
        'storage_used_bytes' => (int) $user['storage_used_bytes'],
    ],
]);
