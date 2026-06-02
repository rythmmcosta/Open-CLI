<?php
// ============================================================
// Open CLI — GET /api/me
// Header: Authorization: Bearer <token>
// Returns: user profile
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';

$payload = bearer_auth();
if (!$payload) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$pdo  = db();
$stmt = $pdo->prepare(
    'SELECT id, name, email, is_verified, quota_bytes, storage_used_bytes, created_at
     FROM users WHERE id = ?'
);
$stmt->execute([$payload['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'User not found']);
    exit;
}

echo json_encode([
    'success' => true,
    'user'    => [
        'id'                => (int) $user['id'],
        'name'              => $user['name'],
        'email'             => $user['email'],
        'is_verified'       => (bool) $user['is_verified'],
        'quota_bytes'       => (int) $user['quota_bytes'],
        'storage_used_bytes'=> (int) $user['storage_used_bytes'],
        'created_at'        => $user['created_at'],
    ],
]);
