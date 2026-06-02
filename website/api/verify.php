<?php
// ============================================================
// Open CLI — POST /api/verify
// Body: { email, otp }
// Returns: { success: true, token: "JWT" }
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

// Rate limit: 10 OTP attempts per 30 minutes per IP
checkRateLimit($pdo, $ip, 'verify', 10, 30);

$body  = json_decode(file_get_contents('php://input'), true);
$email = trim($body['email'] ?? '');
$otp   = trim($body['otp']   ?? '');

if (!$email || !$otp) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'email and otp are required']);
    exit;
}

// Fetch user
$stmt = $pdo->prepare('SELECT id, name, is_verified FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'User not found']);
    exit;
}

// Fetch OTP
$stmt = $pdo->prepare(
    'SELECT id FROM otps WHERE user_id = ? AND otp = ? AND expires_at > NOW()'
);
$stmt->execute([$user['id'], $otp]);
$row = $stmt->fetch();

if (!$row) {
    recordAttempt($pdo, $ip, 'verify');
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid or expired OTP']);
    exit;
}

// Successful verification — mark verified, delete OTP, clear rate limit
$pdo->prepare('UPDATE users SET is_verified = 1 WHERE id = ?')->execute([$user['id']]);
$pdo->prepare('DELETE FROM otps WHERE user_id = ?')->execute([$user['id']]);
clearAttempts($pdo, $ip, 'verify');

$token = jwt_encode(['user_id' => $user['id'], 'email' => $email]);

echo json_encode([
    'success' => true,
    'token'   => $token,
    'user'    => ['id' => $user['id'], 'email' => $email, 'name' => $user['name']],
]);
