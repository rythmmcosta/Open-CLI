<?php
// ============================================================
// Open CLI Admin — Chat History Viewer
// GET ?user_id=N           → chat sessions for user
// GET ?session_id=X        → messages in a session
// GET ?user_id=N&session_id=X → messages (validates ownership)
// DELETE ?session_id=X     → delete session + messages
// DELETE ?message_id=X     → delete single message
// ============================================================

require_once __DIR__ . '/admin-config.php';
requireAdminAuth();

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = db();

// ── GET ─────────────────────────────────────────────────────
if ($method === 'GET') {
    // Messages in a specific session
    if (!empty($_GET['session_id'])) {
        $sessionId = $_GET['session_id'];

        // If user_id also provided, verify ownership
        if (!empty($_GET['user_id'])) {
            $userId = (int) $_GET['user_id'];
            $check  = $pdo->prepare('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?');
            $check->execute([$sessionId, $userId]);
            if (!$check->fetch()) adminJsonError('Session not found for this user', 404);
        }

        $stmt = $pdo->prepare(
            'SELECT id, session_id, role, content, model, created_at
             FROM chat_messages
             WHERE session_id = ?
             ORDER BY created_at ASC'
        );
        $stmt->execute([$sessionId]);
        adminJsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Sessions for a user (or all sessions with user email, limited)
    if (!empty($_GET['user_id'])) {
        $userId = (int) $_GET['user_id'];
        $stmt   = $pdo->prepare(
            'SELECT cs.*, u.email,
                    (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count
             FROM chat_sessions cs
             JOIN users u ON cs.user_id = u.id
             WHERE cs.user_id = ?
             ORDER BY cs.created_at DESC'
        );
        $stmt->execute([$userId]);
    } else {
        $stmt = $pdo->query(
            'SELECT cs.*, u.email,
                    (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count
             FROM chat_sessions cs
             JOIN users u ON cs.user_id = u.id
             ORDER BY cs.created_at DESC
             LIMIT 200'
        );
    }

    adminJsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── DELETE ───────────────────────────────────────────────────
if ($method === 'DELETE') {
    // Delete a single message
    if (!empty($_GET['message_id'])) {
        $msgId = (int) $_GET['message_id'];
        $pdo->prepare('DELETE FROM chat_messages WHERE id = ?')->execute([$msgId]);
        adminJsonResponse(['success' => true]);
    }

    // Delete entire session + messages (messages cascade via FK)
    if (!empty($_GET['session_id'])) {
        $sessionId = $_GET['session_id'];
        // Delete messages first (in case no FK cascade)
        $pdo->prepare('DELETE FROM chat_messages WHERE session_id = ?')->execute([$sessionId]);
        $pdo->prepare('DELETE FROM chat_sessions WHERE id = ?')->execute([$sessionId]);
        adminJsonResponse(['success' => true]);
    }

    adminJsonError('session_id or message_id parameter required', 400);
}

adminJsonError('Method not allowed', 405);
