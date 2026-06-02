<?php
// ============================================================
// Open CLI Admin — Authentication Endpoint
// POST  { password }          → login
// DELETE / POST { logout:true } → logout
// GET                          → check auth status
// ============================================================

require_once __DIR__ . '/admin-config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — check auth status ──────────────────────────────────
if ($method === 'GET') {
    $secret = getenv('ADMIN_SECRET');
    if (!$secret) {
        adminJsonResponse(['authenticated' => false, 'reason' => 'Admin not configured']);
    }
    $token    = $_COOKIE[ADMIN_COOKIE_NAME] ?? '';
    $expected = hash('sha256', $secret . 'admin_salt');
    $authenticated = ($token !== '' && hash_equals($expected, $token));
    adminJsonResponse(['authenticated' => $authenticated]);
}

// ── DELETE — logout ──────────────────────────────────────────
if ($method === 'DELETE') {
    setcookie(ADMIN_COOKIE_NAME, '', [
        'expires'  => time() - 3600,
        'path'     => '/ad-admin/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    adminJsonResponse(['success' => true]);
}

// ── POST — login or explicit logout ─────────────────────────
if ($method === 'POST') {
    $body = adminGetBody();

    // Explicit logout via POST body
    if (!empty($body['logout'])) {
        setcookie(ADMIN_COOKIE_NAME, '', [
            'expires'  => time() - 3600,
            'path'     => '/ad-admin/',
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        adminJsonResponse(['success' => true]);
    }

    // Login
    $password = $body['password'] ?? '';
    if ($password === '') {
        adminJsonError('Password is required', 400);
    }

    $secret = getenv('ADMIN_SECRET');
    if (!$secret) {
        adminJsonError('Admin not configured. Set ADMIN_SECRET env var.', 503);
    }

    // Timing-safe comparison
    if (!hash_equals($secret, $password)) {
        // Artificial delay to slow brute-force
        usleep(500000);
        adminJsonError('Invalid password', 401);
    }

    $token = hash('sha256', $secret . 'admin_salt');
    setcookie(ADMIN_COOKIE_NAME, $token, [
        'expires'  => time() + ADMIN_SESSION_HOURS * 3600,
        'path'     => '/ad-admin/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    adminJsonResponse(['success' => true]);
}

// ── Method not allowed ────────────────────────────────────────
adminJsonError('Method not allowed', 405);
