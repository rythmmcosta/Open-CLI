<?php
// ============================================================
// Open CLI — /api/announcements
// GET    — returns active announcements (no auth required)
// POST   — create announcement (admin only via ADMIN_SECRET)
// DELETE ?id=N — delete by ID (admin only)
// ============================================================
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$pdo = db();

// ── Admin authentication helper ──────────────────────────────
function requireAdmin(): void {
    $adminSecret = getenv('ADMIN_SECRET');
    if (!$adminSecret) {
        jsonError('Admin access not configured', 500);
    }
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $provided = str_starts_with($auth, 'Bearer ') ? substr($auth, 7) : '';
    if (!hash_equals($adminSecret, $provided)) {
        jsonError('Unauthorized', 401);
    }
}

// ── GET: public list of active announcements ─────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare(
        'SELECT id, title, message, level, created_at
         FROM announcements
         WHERE is_active=1 AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC'
    );
    $stmt->execute();
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── POST: create announcement (admin only) ───────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireAdmin();

    $body    = json_decode(file_get_contents('php://input'), true);
    $title   = trim($body['title']   ?? '');
    $message = trim($body['message'] ?? '');
    $level   = $body['level']      ?? 'info';
    $expiresAt = $body['expires_at'] ?? null;

    if (!$title)   jsonError('title is required', 422);
    if (!$message) jsonError('message is required', 422);
    if (!in_array($level, ['info', 'warning', 'critical'])) {
        jsonError('level must be info, warning, or critical', 422);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO announcements (title, message, level, is_active, expires_at)
         VALUES (?, ?, ?, 1, ?)'
    );
    $stmt->execute([$title, $message, $level, $expiresAt]);
    $id = (int) $pdo->lastInsertId();

    jsonResponse(['success' => true, 'id' => $id], 201);
}

// ── DELETE: remove announcement (admin only) ─────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    requireAdmin();

    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) jsonError('id is required', 422);

    $stmt = $pdo->prepare('DELETE FROM announcements WHERE id=?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        jsonError('Announcement not found', 404);
    }

    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
