<?php
// ============================================================
// Open CLI — GET /api/chat-sessions
// Returns paginated list of chat sessions for the logged-in user.
// Query params: ?limit=50&offset=0
// Returns: { sessions: [...], total: N, limit: N, offset: N }
// ============================================================
require_once __DIR__ . '/config.php';
$user = requireAuth();
$pdo  = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('Method not allowed', 405);

$limit  = max(1, min(200, (int) ($_GET['limit']  ?? 50)));
$offset = max(0, (int) ($_GET['offset'] ?? 0));

// Total count
$countStmt = $pdo->prepare('SELECT COUNT(*) FROM chat_sessions WHERE user_id=?');
$countStmt->execute([$user['id']]);
$total = (int) $countStmt->fetchColumn();

// Paginated results
$stmt = $pdo->prepare(
    'SELECT id, project_hash, project_name, model, skill,
            msg_count, input_tokens, output_tokens, cost_usd,
            started_at, ended_at, synced_at
     FROM chat_sessions
     WHERE user_id=?
     ORDER BY started_at DESC
     LIMIT ? OFFSET ?'
);
$stmt->execute([$user['id'], $limit, $offset]);
$sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

jsonResponse([
    'sessions' => $sessions,
    'total'    => $total,
    'limit'    => $limit,
    'offset'   => $offset,
]);
