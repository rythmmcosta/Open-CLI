<?php
require_once 'config.php';
require_once 'jwt.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['code'])) {
    $appId       = getenv('FB_APP_ID');
    $appSecret   = getenv('FB_APP_SECRET');
    $redirectUri = 'https://opencli.myowncloud.tech/api/oauth-facebook.php';

    if (!$appId || !$appSecret) {
        header('Location: /dashboard/?error=oauth_not_configured');
        exit;
    }

    // Exchange code for access token
    $tokenUrl  = "https://graph.facebook.com/v18.0/oauth/access_token?" . http_build_query([
        'client_id'     => $appId,
        'client_secret' => $appSecret,
        'redirect_uri'  => $redirectUri,
        'code'          => $_GET['code'],
    ]);
    $tokenData   = json_decode(file_get_contents($tokenUrl), true);
    $accessToken = $tokenData['access_token'] ?? null;

    if (!$accessToken) { header('Location: /dashboard/?error=oauth_failed'); exit; }

    // Get user info
    $userUrl  = "https://graph.facebook.com/me?fields=id,name,email,picture&access_token={$accessToken}";
    $userData = json_decode(file_get_contents($userUrl), true);

    $email   = $userData['email'] ?? null;
    $name    = $userData['name']  ?? 'User';
    $oauthId = $userData['id']    ?? null;
    $avatar  = $userData['picture']['data']['url'] ?? null;

    if (!$email) { header('Location: /dashboard/?error=no_email'); exit; }

    require_once __DIR__ . '/db.php';
    $pdo = db();

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
        $pdo->prepare('UPDATE users SET oauth_provider="facebook", oauth_id=?, avatar_url=COALESCE(?,avatar_url), updated_at=NOW() WHERE id=?')
            ->execute([$oauthId, $avatar, $existing]);
        $userId = $existing;
    } else {
        $pdo->prepare('INSERT INTO users (email, name, password_hash, oauth_provider, oauth_id, avatar_url, is_verified, created_at, updated_at) VALUES (?,?,?,?,?,?,1,NOW(),NOW())')
            ->execute([$email, $name, password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT), 'facebook', $oauthId, $avatar]);
        $userId = $pdo->lastInsertId();
    }

    $token = generateToken(['id' => $userId, 'email' => $email]);
    header('Location: /dashboard/?token=' . urlencode($token));
    exit;
}

$appId = getenv('FB_APP_ID');
if (!$appId) { jsonError('Facebook OAuth not configured. Set FB_APP_ID env var.', 503); }
$redirectUri = urlencode('https://opencli.myowncloud.tech/api/oauth-facebook.php');
header("Location: https://www.facebook.com/v18.0/dialog/oauth?client_id={$appId}&redirect_uri={$redirectUri}&scope=email");
exit;
