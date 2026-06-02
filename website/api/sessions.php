<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare('SELECT id, device_name as device, ip_address, last_active, created_at FROM user_sessions WHERE user_id = ? ORDER BY last_active DESC');
    $stmt->execute([$user['id']]);
    jsonResponse(['sessions' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE id = ? AND user_id = ?');
    $stmt->execute([$body['id'] ?? 0, $user['id']]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
