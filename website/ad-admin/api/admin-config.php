<?php
// ============================================================
// Open CLI — Admin Configuration & Shared Helpers
// ============================================================

// Reuse parent api's db.php (which also loads config.php)
require_once dirname(__DIR__, 2) . '/api/db.php';

define('ADMIN_COOKIE_NAME', 'opencli_admin_session');
define('ADMIN_SESSION_HOURS', 24);

/**
 * Verify the admin session cookie. Exits with 401 if not authenticated.
 * Also exits with 503 if ADMIN_SECRET is not configured.
 */
function requireAdminAuth(): void {
    $secret = getenv('ADMIN_SECRET');
    if (!$secret) {
        http_response_code(503);
        header('Content-Type: application/json');
        header('X-Content-Type-Options: nosniff');
        echo json_encode(['error' => 'Admin not configured. Set ADMIN_SECRET env var.']);
        exit;
    }

    $token = $_COOKIE[ADMIN_COOKIE_NAME] ?? '';
    $expected = hash('sha256', $secret . 'admin_salt');

    if (!$token || !hash_equals($expected, $token)) {
        http_response_code(401);
        header('Content-Type: application/json');
        header('X-Content-Type-Options: nosniff');
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

/**
 * Send a JSON response and exit.
 */
function adminJsonResponse($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data);
    exit;
}

/**
 * Send a JSON error response and exit.
 */
function adminJsonError(string $message, int $status = 400): void {
    adminJsonResponse(['error' => $message], $status);
}

/**
 * Parse JSON request body and return as array. Exits on malformed JSON.
 */
function adminGetBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        adminJsonError('Invalid JSON body', 400);
    }
    return $data ?? [];
}
