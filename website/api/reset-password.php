<?php
// ============================================================
// Open CLI — POST /api/reset-password
// Body: { token, password }
// Returns: { success: true }
// ============================================================
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { jsonResponse([]); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');

$body     = json_decode(file_get_contents('php://input'), true);
$token    = trim($body['token']    ?? '');
$password = trim($body['password'] ?? '');

if (!$token) {
    jsonError('Reset token is required', 422);
}
if (strlen($password) < 8) {
    jsonError('Password must be at least 8 characters', 422);
}

$pdo  = db();

// Look up the reset token — must be valid, unexpired, and not used
$stmt = $pdo->prepare(
    'SELECT id, user_id FROM password_resets
     WHERE token=? AND used=0 AND expires_at > NOW()'
);
$stmt->execute([$token]);
$reset = $stmt->fetch();

if (!$reset) {
    jsonError('Invalid or expired reset token', 400);
}

// Hash new password and update the user
$hash = password_hash($password, PASSWORD_BCRYPT);
$pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')
    ->execute([$hash, $reset['user_id']]);

// Mark the reset token as used
$pdo->prepare('UPDATE password_resets SET used=1 WHERE id=?')
    ->execute([$reset['id']]);

jsonResponse(['success' => true, 'message' => 'Password reset successfully.']);
