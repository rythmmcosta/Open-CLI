<?php
// ============================================================
// Open CLI Admin — File / Sync Package Browser
// GET ?user_id=N   → packages for a specific user
// GET              → all packages (latest 100) with user emails
// DELETE ?id=N     → delete package row + physical file
// ============================================================

require_once __DIR__ . '/admin-config.php';
requireAdminAuth();

$method      = $_SERVER['REQUEST_METHOD'];
$pdo         = db();
$storageRoot = rtrim(getenv('OPENCLI_STORAGE_ROOT') ?: (sys_get_temp_dir() . '/opencli_uploads'), '/');

// ── GET ─────────────────────────────────────────────────────
if ($method === 'GET') {
    if (!empty($_GET['user_id'])) {
        $userId = (int) $_GET['user_id'];
        $stmt   = $pdo->prepare(
            'SELECT sp.*, u.email
             FROM sync_packages sp
             JOIN users u ON sp.user_id = u.id
             WHERE sp.user_id = ?
             ORDER BY sp.synced_at DESC'
        );
        $stmt->execute([$userId]);
    } else {
        $stmt = $pdo->query(
            'SELECT sp.*, u.email
             FROM sync_packages sp
             JOIN users u ON sp.user_id = u.id
             ORDER BY sp.synced_at DESC
             LIMIT 100'
        );
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Annotate each row with whether the physical file exists
    foreach ($rows as &$row) {
        $path           = $storageRoot . '/' . $row['user_id'] . '/' . $row['project_hash'] . '.tar.gz';
        $row['file_exists'] = file_exists($path);
        $row['file_path']   = $path;
    }
    unset($row);

    adminJsonResponse($rows);
}

// ── DELETE — remove package ──────────────────────────────────
if ($method === 'DELETE') {
    if (empty($_GET['id'])) adminJsonError('id parameter required', 400);
    $id = (int) $_GET['id'];

    $stmt = $pdo->prepare('SELECT user_id, project_hash FROM sync_packages WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) adminJsonError('Package not found', 404);

    // Remove physical file
    $path = $storageRoot . '/' . $row['user_id'] . '/' . $row['project_hash'] . '.tar.gz';
    $deleted = false;
    if (file_exists($path)) {
        $deleted = @unlink($path);
    }

    // Delete row (also updates user storage_used_bytes via app logic — we do it manually here)
    $stmt2 = $pdo->prepare('SELECT file_size_bytes FROM sync_packages WHERE id = ?');
    $stmt2->execute([$id]);
    $size = (int) ($stmt2->fetchColumn() ?: 0);

    $pdo->prepare('DELETE FROM sync_packages WHERE id = ?')->execute([$id]);

    // Recalculate storage used
    $pdo->prepare(
        'UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes - ?) WHERE id = ?'
    )->execute([$size, $row['user_id']]);

    adminJsonResponse(['success' => true, 'file_deleted' => $deleted, 'bytes_freed' => $size]);
}

adminJsonError('Method not allowed', 405);
