<?php
// ============================================================
// Open CLI — POST /api/refresh-token
// Reads Bearer token from Authorization header.
// Issues a new JWT if the existing token is valid and was issued
// more than 23 days ago (within the last 7 days of its 30-day life).
// Returns: { token: "newJWT" }
// ============================================================
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { jsonResponse([]); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

// Decode the current token (jwt_decode validates signature and expiry)
$payload = bearer_auth();
if (!$payload) {
    jsonError('Unauthorized', 401);
}

// Determine the token's age in seconds
$issuedAt = $payload['iat'] ?? 0;
$ageSeconds = time() - $issuedAt;

// Only refresh if issued more than 23 days ago (2073600 seconds)
// This covers the last 7-day window before the 30-day expiry.
$refreshThreshold = 23 * 24 * 60 * 60; // 23 days in seconds
if ($ageSeconds < $refreshThreshold) {
    jsonError('Token does not need refreshing yet', 400);
}

// Verify user still exists
$pdo  = db();
$userId = $payload['id'] ?? $payload['user_id'] ?? null;
if (!$userId) {
    jsonError('Unauthorized', 401);
}

$stmt = $pdo->prepare('SELECT id, email FROM users WHERE id=?');
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user) {
    jsonError('Unauthorized', 401);
}

// Issue a fresh token
$newToken = jwt_encode(['id' => $user['id'], 'email' => $user['email']]);

jsonResponse(['token' => $newToken]);
