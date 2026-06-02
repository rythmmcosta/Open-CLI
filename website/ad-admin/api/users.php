<?php
// ============================================================
// Open CLI Admin — User Management
// GET ?page=N&q=search  → paginated user list
// GET ?id=N             → single user detail
// PATCH ?id=N           → update user fields
// DELETE ?id=N          → delete user
// ============================================================

require_once __DIR__ . '/admin-config.php';
requireAdminAuth();

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = db();

// ── GET ─────────────────────────────────────────────────────
if ($method === 'GET') {
    // Single user detail
    if (!empty($_GET['id'])) {
        $id   = (int) $_GET['id'];
        $stmt = $pdo->prepare(
            'SELECT id, email, name, oauth_provider, is_verified, storage_used_bytes,
                    quota_bytes, created_at, updated_at,
                    (SELECT COUNT(*) FROM sync_packages WHERE user_id=u.id) AS total_packages,
                    (SELECT COUNT(*) FROM chat_sessions  WHERE user_id=u.id) AS total_sessions,
                    (SELECT COUNT(*) FROM devices        WHERE user_id=u.id) AS total_devices
             FROM users u WHERE id = ?'
        );
        $stmt->execute([$id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) adminJsonError('User not found', 404);
        adminJsonResponse($user);
    }

    // Paginated list
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = 20;
    $offset  = ($page - 1) * $perPage;
    $q       = trim($_GET['q'] ?? '');

    if ($q !== '') {
        $like  = '%' . $q . '%';
        $total = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email LIKE ? OR name LIKE ?');
        $total->execute([$like, $like]);
        $stmt  = $pdo->prepare(
            'SELECT id, email, name, oauth_provider, is_verified, storage_used_bytes, quota_bytes, created_at, updated_at
             FROM users WHERE email LIKE ? OR name LIKE ?
             ORDER BY created_at DESC LIMIT ' . $perPage . ' OFFSET ' . $offset
        );
        $stmt->execute([$like, $like]);
    } else {
        $total = $pdo->query('SELECT COUNT(*) FROM users');
        $stmt  = $pdo->prepare(
            'SELECT id, email, name, oauth_provider, is_verified, storage_used_bytes, quota_bytes, created_at, updated_at
             FROM users ORDER BY created_at DESC LIMIT ' . $perPage . ' OFFSET ' . $offset
        );
        $stmt->execute();
    }

    $totalCount = (int) $total->fetchColumn();
    adminJsonResponse([
        'users'       => $stmt->fetchAll(PDO::FETCH_ASSOC),
        'total'       => $totalCount,
        'page'        => $page,
        'per_page'    => $perPage,
        'total_pages' => (int) ceil($totalCount / $perPage),
    ]);
}

// ── PATCH — update user ─────────────────────────────────────
if ($method === 'PATCH') {
    if (empty($_GET['id'])) adminJsonError('id parameter required', 400);
    $id   = (int) $_GET['id'];
    $body = adminGetBody();

    $allowed = ['name', 'email', 'is_verified', 'quota_bytes'];
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
    $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')
        ->execute($params);

    adminJsonResponse(['success' => true]);
}

// ── DELETE — remove user ────────────────────────────────────
if ($method === 'DELETE') {
    if (empty($_GET['id'])) adminJsonError('id parameter required', 400);
    $id = (int) $_GET['id'];

    // Fetch archive paths before deletion so we can remove physical files
    $files = $pdo->prepare('SELECT user_id, project_hash FROM sync_packages WHERE user_id = ?');
    $files->execute([$id]);
    $packages = $files->fetchAll(PDO::FETCH_ASSOC);

    // Delete user (cascade deletes child rows via FK)
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);

    // Remove physical archives
    $storageRoot = rtrim(getenv('OPENCLI_STORAGE_ROOT') ?: (sys_get_temp_dir() . '/opencli_uploads'), '/');
    foreach ($packages as $pkg) {
        $path = $storageRoot . '/' . $pkg['user_id'] . '/' . $pkg['project_hash'] . '.tar.gz';
        if (file_exists($path)) @unlink($path);
    }

    adminJsonResponse(['success' => true, 'deleted_packages' => count($packages)]);
}

adminJsonError('Method not allowed', 405);
