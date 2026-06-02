<?php
// ============================================================
// Open CLI Admin — Aggregate Statistics
// GET → returns all stats as a single JSON object
// ============================================================

require_once __DIR__ . '/admin-config.php';
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') adminJsonError('Method not allowed', 405);

$pdo = db();

// ── User overview ────────────────────────────────────────────
$userStats = $pdo->query(
    'SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) AS verified_users,
        COALESCE(SUM(storage_used_bytes), 0) AS total_storage_bytes
     FROM users'
)->fetch(PDO::FETCH_ASSOC);

// ── New users — last 30 days by day ──────────────────────────
$usersPerDay = $pdo->query(
    'SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM users
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC'
)->fetchAll(PDO::FETCH_ASSOC);

// ── Top models used ──────────────────────────────────────────
$topModels = [];
try {
    $topModels = $pdo->query(
        'SELECT model, COUNT(*) AS sessions
         FROM chat_sessions
         WHERE model IS NOT NULL AND model != \'\'
         GROUP BY model
         ORDER BY sessions DESC
         LIMIT 10'
    )->fetchAll(PDO::FETCH_ASSOC);
} catch (\Exception $e) { /* table may not exist yet */ }

// ── Top skills used ──────────────────────────────────────────
$topSkills = [];
try {
    $topSkills = $pdo->query(
        'SELECT skill, COUNT(*) AS sessions
         FROM chat_sessions
         WHERE skill IS NOT NULL AND skill != \'\'
         GROUP BY skill
         ORDER BY sessions DESC
         LIMIT 10'
    )->fetchAll(PDO::FETCH_ASSOC);
} catch (\Exception $e) { /* table may not exist yet */ }

// ── Total chat sessions + messages ──────────────────────────
$totalSessions = 0;
$totalMessages = 0;
try {
    $totalSessions = (int) $pdo->query('SELECT COUNT(*) FROM chat_sessions')->fetchColumn();
    $totalMessages = (int) $pdo->query('SELECT COUNT(*) FROM chat_messages')->fetchColumn();
} catch (\Exception $e) { /* table may not exist yet */ }

// ── Sync packages ────────────────────────────────────────────
$totalPackages = (int) $pdo->query('SELECT COUNT(*) FROM sync_packages')->fetchColumn();

// ── Recent registrations (last 7 rows) ──────────────────────
$recentUsers = $pdo->query(
    'SELECT id, email, name, is_verified, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT 7'
)->fetchAll(PDO::FETCH_ASSOC);

adminJsonResponse([
    'users'           => $userStats,
    'users_per_day'   => $usersPerDay,
    'top_models'      => $topModels,
    'top_skills'      => $topSkills,
    'total_sessions'  => $totalSessions,
    'total_messages'  => $totalMessages,
    'total_packages'  => $totalPackages,
    'recent_users'    => $recentUsers,
]);
