<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Gather all user data
    $stmt = $pdo->prepare('SELECT id, email, name as display_name, storage_used_bytes, quota_bytes as storage_quota_bytes, created_at, updated_at as last_login FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare('SELECT project_name, file_size_bytes as size_bytes, synced_at as uploaded_at FROM sync_packages WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare('SELECT name, command, tags FROM snippets WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $snippets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $export = [
        'export_date' => date('c'),
        'profile'     => $profile,
        'projects'    => $projects,
        'snippets'    => $snippets,
    ];

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="opencli-export-' . date('Ymd') . '.json"');
    header('Access-Control-Allow-Origin: https://opencli.myowncloud.tech');
    echo json_encode($export, JSON_PRETTY_PRINT);
    exit;
}

jsonError('Method not allowed', 405);
