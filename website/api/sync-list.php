<?php
// ============================================================
// Open CLI — GET /api/sync-list
// Header: Authorization: Bearer <token>
// Returns: { success: true, projects: [...] }
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
    'SELECT project_hash, project_name, file_size_bytes, device_label, synced_at
     FROM sync_packages WHERE user_id = ? ORDER BY synced_at DESC'
);
$stmt->execute([$payload['user_id']]);
$rows = $stmt->fetchAll();

echo json_encode(['success' => true, 'projects' => $rows]);
