<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare('SELECT id, name, command, tags, created_at FROM snippets WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    jsonResponse(['snippets' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $name = trim($body['name'] ?? '');
    $command = trim($body['command'] ?? '');
    if (!$name || !$command) jsonError('Name and command required', 400);
    $stmt = $pdo->prepare('INSERT INTO snippets (user_id, name, command, tags, created_at) VALUES (?, ?, ?, ?, NOW())');
    $stmt->execute([$user['id'], $name, $command, $body['tags'] ?? '']);
    $id = $pdo->lastInsertId();
    jsonResponse(['snippet' => ['id' => $id, 'name' => $name, 'command' => $command, 'tags' => $body['tags'] ?? '']]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare('DELETE FROM snippets WHERE id = ? AND user_id = ?');
    $stmt->execute([$body['id'] ?? 0, $user['id']]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
