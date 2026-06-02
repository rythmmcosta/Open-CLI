<?php
// ============================================================
// Open CLI — POST /api/register
// Body: { email, password, name }
// Returns: { success: true, message: "OTP sent" }
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
require_once __DIR__ . '/config.php';

$body = json_decode(file_get_contents('php://input'), true);
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');
$name     = trim($body['name']     ?? '');

// Validate
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid email address']);
    exit;
}
if (strlen($password) < 8) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters']);
    exit;
}
if (strlen($name) < 2) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Name is required']);
    exit;
}

$pdo = db();

// Check duplicate
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'error' => 'Email already registered']);
    exit;
}

// Insert user (unverified)
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare(
    'INSERT INTO users (email, password_hash, name, is_verified, quota_bytes, created_at)
     VALUES (?, ?, ?, 0, ?, NOW())'
);
$stmt->execute([$email, $hash, $name, DEFAULT_QUOTA_BYTES]);
$userId = (int) $pdo->lastInsertId();

// Generate 6-digit OTP
$otp    = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expiry = date('Y-m-d H:i:s', time() + OTP_EXPIRY_MINUTES * 60);

// Store OTP (clear previous)
$pdo->prepare('DELETE FROM otps WHERE user_id = ?')->execute([$userId]);
$pdo->prepare('INSERT INTO otps (user_id, otp, expires_at) VALUES (?, ?, ?)')
    ->execute([$userId, $otp, $expiry]);

// Send OTP email
$subject = 'Your Open CLI verification code';
$message = "Hi $name,\n\nYour verification code is: $otp\n\nIt expires in " . OTP_EXPIRY_MINUTES . " minutes.\n\nIf you didn't request this, ignore this email.\n\n— Open CLI";
$headers = 'From: ' . MAIL_FROM . "\r\nReply-To: " . MAIL_FROM;
mail($email, $subject, $message, $headers);

echo json_encode(['success' => true, 'message' => 'OTP sent to ' . $email]);
