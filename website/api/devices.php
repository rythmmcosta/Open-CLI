<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare('SELECT id, device_label as device_name, last_seen_at as last_sync, registered_at as created_at FROM devices WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse(['devices' => $devices]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id = $body['id'] ?? null;
    if (!$id) jsonError('Missing id', 400);
    $stmt = $pdo->prepare('DELETE FROM devices WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $user['id']]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
