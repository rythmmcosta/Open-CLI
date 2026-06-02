<?php
// ============================================================
// Open CLI Admin — Announcement Management
// GET              → list all announcements
// POST             → create { title, message, level, expires_at? }
// PATCH ?id=N      → toggle active { is_active }
// DELETE ?id=N     → delete
// ============================================================

require_once __DIR__ . '/admin-config.php';
requireAdminAuth();

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = db();

// Ensure table exists
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS announcements (
        id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title      VARCHAR(255)  NOT NULL DEFAULT \'\',
        message    TEXT          NOT NULL,
        level      ENUM(\'info\',\'warning\',\'error\',\'success\') NOT NULL DEFAULT \'info\',
        is_active  TINYINT(1)    NOT NULL DEFAULT 1,
        expires_at DATETIME      DEFAULT NULL,
        created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

// ── GET ─────────────────────────────────────────────────────
if ($method === 'GET') {
    $rows = $pdo->query(
        'SELECT * FROM announcements ORDER BY created_at DESC'
    )->fetchAll(PDO::FETCH_ASSOC);
    adminJsonResponse($rows);
}

// ── POST — create ────────────────────────────────────────────
if ($method === 'POST') {
    $body    = adminGetBody();
    $title   = trim($body['title']   ?? '');
    $message = trim($body['message'] ?? '');
    $level   = in_array($body['level'] ?? '', ['info','warning','error','success']) ? $body['level'] : 'info';
    $expires = !empty($body['expires_at']) ? $body['expires_at'] : null;

    if ($message === '') adminJsonError('message is required', 400);

    $stmt = $pdo->prepare(
        'INSERT INTO announcements (title, message, level, expires_at) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$title, $message, $level, $expires]);

    adminJsonResponse(['success' => true, 'id' => (int) $pdo->lastInsertId()]);
}

// ── PATCH — update ───────────────────────────────────────────
if ($method === 'PATCH') {
    if (empty($_GET['id'])) adminJsonError('id parameter required', 400);
    $id   = (int) $_GET['id'];
    $body = adminGetBody();

    $allowed = ['title', 'message', 'level', 'is_active', 'expires_at'];
    $sets    = [];
    $params  = [];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[]   = "`{$field}` = ?";
            $params[] = $body[$field];
        }
    }

    if (empty($sets)) adminJsonError('No valid fields to update', 400);

    $params[] = $id;
    $pdo->prepare('UPDATE announcements SET ' . implode(', ', $sets) . ' WHERE id = ?')
        ->execute($params);

    adminJsonResponse(['success' => true]);
}

// ── DELETE ───────────────────────────────────────────────────
if ($method === 'DELETE') {
    if (empty($_GET['id'])) adminJsonError('id parameter required', 400);
    $id = (int) $_GET['id'];
    $pdo->prepare('DELETE FROM announcements WHERE id = ?')->execute([$id]);
    adminJsonResponse(['success' => true]);
}

adminJsonError('Method not allowed', 405);
