<?php
// ============================================================
// Open CLI — POST /api/chat-push
// Receive chat history (sessions + messages) from CLI for sync.
// Body: { sessions: [...], messages: [...] }
// Returns: { success: true, sessions_synced: N, messages_synced: N }
// ============================================================
require_once __DIR__ . '/config.php';
$user = requireAuth();
$pdo  = $GLOBALS['pdo'];

$body     = json_decode(file_get_contents('php://input'), true);
$sessions = $body['sessions'] ?? [];
$messages = $body['messages'] ?? [];

// Upsert sessions
foreach ($sessions as $s) {
    $pdo->prepare(
        'INSERT INTO chat_sessions
            (id, user_id, project_hash, project_name, model, skill, msg_count, input_tokens, output_tokens, cost_usd, started_at, ended_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
            msg_count=VALUES(msg_count),
            ended_at=VALUES(ended_at),
            synced_at=NOW()'
    )->execute([
        $s['id'],
        $user['id'],
        $s['project_hash']  ?? null,
        $s['project_name']  ?? null,
        $s['model']         ?? null,
        $s['skill']         ?? null,
        $s['msg_count']     ?? 0,
        $s['input_tokens']  ?? 0,
        $s['output_tokens'] ?? 0,
        $s['cost_usd']      ?? 0,
        $s['started_at']    ?? null,
        $s['ended_at']      ?? null,
    ]);
}

// Upsert messages (INSERT IGNORE to avoid duplicates without overwriting)
foreach ($messages as $m) {
    $pdo->prepare(
        'INSERT IGNORE INTO chat_messages
            (id, session_id, user_id, role, content, tool_calls, tokens, created_at)
         VALUES (?,?,?,?,?,?,?,?)'
    )->execute([
        $m['id'],
        $m['session_id'],
        $user['id'],
        $m['role'],
        $m['content']    ?? '',
        isset($m['tool_calls']) ? json_encode($m['tool_calls']) : null,
        $m['tokens']     ?? 0,
        $m['created_at'] ?? null,
    ]);
}

jsonResponse([
    'success'          => true,
    'sessions_synced'  => count($sessions),
    'messages_synced'  => count($messages),
]);
