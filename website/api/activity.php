<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $type = $_GET['type'] ?? 'all';
    $sql = 'SELECT id, action_type as type, message, device_name as device, ip_address, created_at as time FROM activity_log WHERE user_id = ?';
    $params = [$user['id']];
    if ($type !== 'all') { $sql .= ' AND action_type = ?'; $params[] = $type; }
    $sql .= ' ORDER BY created_at DESC LIMIT 100';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['activity' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

jsonError('Method not allowed', 405);
