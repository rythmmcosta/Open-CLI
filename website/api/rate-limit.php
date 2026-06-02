<?php
// ============================================================
// Open CLI — Rate Limiting Helper
// ============================================================

function checkRateLimit(PDO $pdo, string $ip, string $action, int $maxAttempts, int $windowMinutes): void {
    $stmt = $pdo->prepare('SELECT attempts, window_start FROM rate_limit WHERE ip=? AND action=?');
    $stmt->execute([$ip, $action]);
    $row = $stmt->fetch();

    if ($row) {
        $windowStart = strtotime($row['window_start']);
        $windowEnd   = $windowStart + ($windowMinutes * 60);
        if (time() < $windowEnd && $row['attempts'] >= $maxAttempts) {
            $retryAfter = ceil(($windowEnd - time()) / 60);
            http_response_code(429);
            echo json_encode(['error' => "Too many attempts. Try again in {$retryAfter} minutes."]);
            exit;
        }
        if (time() >= $windowEnd) {
            // Window expired, reset
            $pdo->prepare('DELETE FROM rate_limit WHERE ip=? AND action=?')->execute([$ip, $action]);
        }
    }
}

function recordAttempt(PDO $pdo, string $ip, string $action): void {
    $pdo->prepare('INSERT INTO rate_limit (ip, action, attempts, window_start) VALUES (?,?,1,NOW()) ON DUPLICATE KEY UPDATE attempts=attempts+1')
        ->execute([$ip, $action]);
}

function clearAttempts(PDO $pdo, string $ip, string $action): void {
    $pdo->prepare('DELETE FROM rate_limit WHERE ip=? AND action=?')->execute([$ip, $action]);
}

function getClientIp(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) return explode(',', $_SERVER[$key])[0];
    }
    return '0.0.0.0';
}
