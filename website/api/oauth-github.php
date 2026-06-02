<?php
require_once 'config.php';
require_once 'jwt.php';

// Handle OAuth callback (has ?code= param)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['code'])) {
    $clientId = getenv('GITHUB_CLIENT_ID');
    $clientSecret = getenv('GITHUB_CLIENT_SECRET');

    if (!$clientId || !$clientSecret) {
        header('Location: /dashboard/?error=oauth_not_configured');
        exit;
    }

    // Exchange code for access token
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Accept: application/json\r\nContent-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'code' => $_GET['code'],
        ]),
    ]]);
    $tokenRes = @file_get_contents('https://github.com/login/oauth/access_token', false, $context);
    $tokenData = json_decode($tokenRes, true);
    $accessToken = $tokenData['access_token'] ?? null;

    if (!$accessToken) {
        header('Location: /dashboard/?error=oauth_failed');
        exit;
    }

    // Fetch user profile
    $userContext = stream_context_create(['http' => [
        'header' => "Authorization: Bearer {$accessToken}\r\nUser-Agent: OpenCLI/1.0\r\nAccept: application/json\r\n",
    ]]);
    $userData = json_decode(@file_get_contents('https://api.github.com/user', false, $userContext), true);

    $name = $userData['name'] ?? $userData['login'] ?? 'GitHub User';
    $oauthId = (string)($userData['id'] ?? '');
    $avatar = $userData['avatar_url'] ?? null;
    $email = $userData['email'] ?? null;

    // If no public email, fetch from emails endpoint
    if (!$email) {
        $emailsData = json_decode(@file_get_contents('https://api.github.com/user/emails', false, $userContext), true);
        if (is_array($emailsData)) {
            foreach ($emailsData as $e) {
                if (!empty($e['primary']) && !empty($e['verified'])) {
                    $email = $e['email'];
                    break;
                }
            }
            if (!$email && !empty($emailsData[0]['email'])) {
                $email = $emailsData[0]['email'];
            }
        }
    }

    if (!$email) {
        // Use a placeholder email from GitHub username
        $email = ($userData['login'] ?? 'user') . '@github.placeholder';
    }

    require_once __DIR__ . '/db.php';
    $pdo = db();

    // Upsert user
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? OR (oauth_provider = "github" AND oauth_id = ?)');
    $stmt->execute([$email, $oauthId]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
        $pdo->prepare('UPDATE users SET oauth_provider="github", oauth_id=?, avatar_url=COALESCE(?,avatar_url), display_name=COALESCE(NULLIF(?,\'\'),display_name), last_login=NOW() WHERE id=?')
            ->execute([$oauthId, $avatar, $name, $existing]);
        $userId = $existing;
    } else {
        $pdo->prepare('INSERT INTO users (email, display_name, password_hash, oauth_provider, oauth_id, avatar_url, is_verified, created_at, last_login) VALUES (?,?,?,?,?,?,1,NOW(),NOW())')
            ->execute([$email, $name, password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT), 'github', $oauthId, $avatar]);
        $userId = $pdo->lastInsertId();
    }

    $token = generateToken(['id' => $userId, 'email' => $email]);
    header('Location: /dashboard/?token=' . urlencode($token));
    exit;
}

// Initiate GitHub OAuth
$clientId = getenv('GITHUB_CLIENT_ID');
if (!$clientId) {
    jsonError('GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars.', 503);
}
$redirectUri = urlencode('https://opencli.myowncloud.tech/api/oauth-github.php');
header("Location: https://github.com/login/oauth/authorize?client_id={$clientId}&redirect_uri={$redirectUri}&scope=user:email");
exit;
