<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $uid = $user['id'];

    // Delete all user data in order (FK constraints)
    foreach (['sync_packages','devices','api_keys','snippets','webhooks','activity_log','user_sessions','feedback'] as $table) {
        try {
            $stmt = $pdo->prepare("DELETE FROM $table WHERE user_id = ?");
            $stmt->execute([$uid]);
        } catch (\Exception $e) { /* table may not exist yet */ }
    }

    // Delete user
    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$uid]);

    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
