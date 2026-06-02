<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare('SELECT id, name, created_at, last_used, CONCAT(SUBSTR(key_value,1,8),"....",SUBSTR(key_value,-4)) as masked FROM api_keys WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    jsonResponse(['keys' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $name = trim($body['name'] ?? 'API Key');
    $key = 'ocli_' . bin2hex(random_bytes(32));
    $stmt = $pdo->prepare('INSERT INTO api_keys (user_id, name, key_value, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$user['id'], $name, $key]);
    jsonResponse(['key' => $key]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
    $stmt->execute([$body['id'] ?? 0, $user['id']]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
