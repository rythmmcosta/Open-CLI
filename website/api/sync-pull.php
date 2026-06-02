<?php
// ============================================================
// Open CLI — GET /api/sync-pull?project=<hash>
// Header: Authorization: Bearer <token>
// Returns: file download (application/gzip)
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';

$payload = bearer_auth();
if (!$payload) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$userId      = (int) $payload['user_id'];
$projectHash = preg_replace('/[^a-f0-9]/', '', $_GET['project'] ?? '');

if (!$projectHash) {
    http_response_code(422);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'project parameter is required']);
    exit;
}

$pdo  = db();
$stmt = $pdo->prepare(
    'SELECT project_name, file_size_bytes FROM sync_packages WHERE user_id = ? AND project_hash = ?'
);
$stmt->execute([$userId, $projectHash]);
$pkg = $stmt->fetch();

if (!$pkg) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Project not found']);
    exit;
}

$filePath = rtrim(STORAGE_ROOT, '/') . '/' . $userId . '/' . $projectHash . '.tar.gz';

if (!file_exists($filePath)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'File not found on server']);
    exit;
}

header('Content-Type: application/gzip');
header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-z0-9_\-]/i', '_', $pkg['project_name']) . '.tar.gz"');
header('Content-Length: ' . filesize($filePath));
header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
header('Access-Control-Allow-Headers: Authorization');
readfile($filePath);
