<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare('SELECT id, url, event, created_at FROM webhooks WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    jsonResponse(['webhooks' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $url = filter_var($body['url'] ?? '', FILTER_VALIDATE_URL);
    if (!$url) jsonError('Invalid URL', 400);
    $stmt = $pdo->prepare('INSERT INTO webhooks (user_id, url, event, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$user['id'], $url, $body['event'] ?? 'sync']);
    $id = $pdo->lastInsertId();
    jsonResponse(['webhook' => ['id' => $id, 'url' => $url, 'event' => $body['event'] ?? 'sync']]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    // Test webhook
    $body = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare('SELECT url FROM webhooks WHERE id = ? AND user_id = ?');
    $stmt->execute([$body['id'] ?? 0, $user['id']]);
    $wh = $stmt->fetch();
    if ($wh) {
        $ch = curl_init($wh['url']);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['event' => 'test', 'source' => 'opencli']));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_exec($ch);
        curl_close($ch);
    }
    jsonResponse(['success' => true]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare('DELETE FROM webhooks WHERE id = ? AND user_id = ?');
    $stmt->execute([$body['id'] ?? 0, $user['id']]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
