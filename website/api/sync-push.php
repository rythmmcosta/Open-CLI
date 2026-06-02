<?php
// ============================================================
// Open CLI — POST /api/sync-push  (multipart/form-data)
// Header: Authorization: Bearer <token>
// Fields: project_hash, project_name, device_label, file (binary)
// Returns: { success: true }
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

$userId      = (int) $payload['user_id'];
$projectHash = preg_replace('/[^a-f0-9]/', '', $_POST['project_hash'] ?? '');
$projectName = substr(strip_tags($_POST['project_name'] ?? 'unknown'), 0, 255);
$deviceLabel = substr(strip_tags($_POST['device_label'] ?? ''), 0, 100);

if (!$projectHash || !isset($_FILES['file'])) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'project_hash and file are required']);
    exit;
}

if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'File upload error']);
    exit;
}

$pdo = db();

// Check quota
$stmt = $pdo->prepare('SELECT quota_bytes, storage_used_bytes FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

$fileSize   = (int) $_FILES['file']['size'];
$newUsed    = (int) $user['storage_used_bytes'] + $fileSize;

// Subtract existing package size if replacing
$stmt = $pdo->prepare('SELECT file_size_bytes FROM sync_packages WHERE user_id = ? AND project_hash = ?');
$stmt->execute([$userId, $projectHash]);
$existing = $stmt->fetch();
if ($existing) {
    $newUsed -= (int) $existing['file_size_bytes'];
}

if ($newUsed > (int) $user['quota_bytes']) {
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'Storage quota exceeded']);
    exit;
}

// Save file to storage
$userDir = rtrim(STORAGE_ROOT, '/') . '/' . $userId;
if (!is_dir($userDir)) {
    mkdir($userDir, 0750, true);
}
$dest = $userDir . '/' . $projectHash . '.tar.gz';

if (!move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save file']);
    exit;
}

// Upsert sync_packages
$pdo->prepare(
    'INSERT INTO sync_packages (user_id, project_hash, project_name, device_label, file_size_bytes, synced_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       project_name = VALUES(project_name),
       device_label = VALUES(device_label),
       file_size_bytes = VALUES(file_size_bytes),
       synced_at = NOW()'
)->execute([$userId, $projectHash, $projectName, $deviceLabel, $fileSize]);

// Update storage_used_bytes
$pdo->prepare('UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?')
    ->execute([$fileSize - (int)($existing['file_size_bytes'] ?? 0), $userId]);

echo json_encode(['success' => true, 'file_size_bytes' => $fileSize]);
