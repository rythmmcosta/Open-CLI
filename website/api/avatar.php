<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();
$pdo = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['avatar'])) jsonError('No file uploaded', 400);

    $file = $_FILES['avatar'];
    $maxSize = 2 * 1024 * 1024; // 2MB
    if ($file['size'] > $maxSize) jsonError('File too large (max 2MB)', 400);

    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $allowed)) jsonError('Invalid file type', 400);

    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime];
    $uploadsDir = __DIR__ . '/../uploads/avatars/';
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);

    // Delete old avatar
    $stmt = $pdo->prepare('SELECT avatar_url FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $old = $stmt->fetchColumn();
    if ($old && strpos($old, '/uploads/') !== false) {
        $oldPath = __DIR__ . '/..' . parse_url($old, PHP_URL_PATH);
        if (file_exists($oldPath)) unlink($oldPath);
    }

    $filename = 'avatar_' . $user['id'] . '_' . time() . '.' . $ext;
    $dest = $uploadsDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) jsonError('Upload failed', 500);

    $url = '/uploads/avatars/' . $filename;
    $stmt = $pdo->prepare('UPDATE users SET avatar_url = ? WHERE id = ?');
    $stmt->execute([$url, $user['id']]);

    jsonResponse(['url' => $url]);
}

jsonError('Method not allowed', 405);
