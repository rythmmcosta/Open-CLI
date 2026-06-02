<?php
// ============================================================
// Open CLI — GET /api/chat-messages?session_id=XXX
// Returns all messages for a session belonging to the logged-in user.
// Returns: { messages: [...] }
// ============================================================
require_once __DIR__ . '/config.php';
$user = requireAuth();
$pdo  = $GLOBALS['pdo'];

if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('Method not allowed', 405);

$sessionId = trim($_GET['session_id'] ?? '');
if (!$sessionId) jsonError('session_id is required', 422);

// Verify the session belongs to the logged-in user
$stmt = $pdo->prepare('SELECT id FROM chat_sessions WHERE id=? AND user_id=?');
$stmt->execute([$sessionId, $user['id']]);
if (!$stmt->fetch()) {
    jsonError('Session not found', 404);
}

// Fetch all messages for the session
$stmt = $pdo->prepare(
    'SELECT id, session_id, role, content, tool_calls, tokens, created_at, synced_at
     FROM chat_messages
     WHERE session_id=? AND user_id=?
     ORDER BY created_at ASC'
);
$stmt->execute([$sessionId, $user['id']]);
$messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Decode tool_calls JSON strings back to arrays for the response
foreach ($messages as &$m) {
    if ($m['tool_calls'] !== null) {
        $m['tool_calls'] = json_decode($m['tool_calls'], true);
    }
}
unset($m);

jsonResponse(['messages' => $messages]);
