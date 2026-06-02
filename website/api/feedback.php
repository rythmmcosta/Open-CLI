<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $message = trim($body['message'] ?? '');
    if (!$message) jsonError('Message required', 400);

    // Log to DB
    $stmt = $pdo->prepare('INSERT INTO feedback (user_id, email, message, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$user['id'], $user['email'] ?? '', $message]);

    // Optional: send email (only if SMTP configured)
    $to = getenv('ADMIN_EMAIL');
    if ($to) {
        mail($to, 'Open CLI Feedback', "From: {$user['email']}\n\n{$message}");
    }

    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
