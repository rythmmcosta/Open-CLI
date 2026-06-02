<?php
// ============================================================
// Open CLI — POST /api/forgot-password
// Body: { email }
// Returns: { success: true, message: "..." }
// Always returns success to avoid revealing whether email exists.
// ============================================================
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { jsonResponse([]); }
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');

$body  = json_decode(file_get_contents('php://input'), true);
$email = trim($body['email'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Invalid email', 422);

$pdo  = db();
$stmt = $pdo->prepare('SELECT id, name FROM users WHERE email=?');
$stmt->execute([$email]);
$user = $stmt->fetch();

// Always return success (don't reveal if email exists)
if ($user) {
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('DELETE FROM password_resets WHERE user_id=?')->execute([$user['id']]);
    $pdo->prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 1 HOUR))')
        ->execute([$user['id'], $token]);
    $resetUrl = 'https://opencli.myowncloud.tech/reset-password.html?token=' . urlencode($token);
    sendMail($email, $user['name'], 'Reset your Open CLI password', passwordResetEmailHtml($user['name'], $resetUrl));
}

jsonResponse(['success' => true, 'message' => 'If that email exists, a reset link has been sent.']);
