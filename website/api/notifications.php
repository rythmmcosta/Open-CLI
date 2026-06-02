<?php
require_once 'config.php';
require_once 'jwt.php';
$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Return static demo notifications for now (replace with DB query when notifications table added)
    jsonResponse(['notifications' => [], 'unread' => 0]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Mark all as read
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
