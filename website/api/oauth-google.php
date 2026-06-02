<?php
require_once 'config.php';
require_once 'jwt.php';

// Google OAuth callback
// Validates Google ID token and creates/logs in user
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['code'])) {
    // Exchange code for token
    $clientId     = getenv('GOOGLE_CLIENT_ID');
    $clientSecret = getenv('GOOGLE_CLIENT_SECRET');
    $redirectUri  = 'https://opencli.myowncloud.tech/api/oauth-google.php';

    if (!$clientId || !$clientSecret) {
        header('Location: /dashboard/?error=oauth_not_configured');
        exit;
    }

    $tokenRes = file_get_contents('https://oauth2.googleapis.com/token', false, stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query([
            'code'          => $_GET['code'],
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri'  => $redirectUri,
            'grant_type'    => 'authorization_code',
        ]),
    ]]));

    $tokenData = json_decode($tokenRes, true);
    if (empty($tokenData['id_token'])) {
        header('Location: /dashboard/?error=oauth_failed');
        exit;
    }

    // Decode JWT (parts[1] is payload, base64url)
    $parts   = explode('.', $tokenData['id_token']);
    $raw     = $parts[1] ?? '';
    $padded  = str_pad(strtr($raw, '-_', '+/'), strlen($raw) % 4 ? strlen($raw) + 4 - strlen($raw) % 4 : strlen($raw), '=');
    $payload = json_decode(base64_decode($padded), true);

    $email   = $payload['email'] ?? null;
    $name    = $payload['name']  ?? 'User';
    $oauthId = $payload['sub']   ?? null;
    $avatar  = $payload['picture'] ?? null;

    if (!$email) { header('Location: /dashboard/?error=no_email'); exit; }

    require_once __DIR__ . '/db.php';
    $pdo = db();

    // Upsert user
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
        $pdo->prepare('UPDATE users SET oauth_provider="google", oauth_id=?, avatar_url=COALESCE(?,avatar_url), updated_at=NOW() WHERE id=?')
            ->execute([$oauthId, $avatar, $existing]);
        $userId = $existing;
    } else {
        $pdo->prepare('INSERT INTO users (email, name, password_hash, oauth_provider, oauth_id, avatar_url, is_verified, created_at, updated_at) VALUES (?,?,?,?,?,?,1,NOW(),NOW())')
            ->execute([$email, $name, password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT), 'google', $oauthId, $avatar]);
        $userId = $pdo->lastInsertId();
    }

    $token = generateToken(['id' => $userId, 'email' => $email]);
    header('Location: /dashboard/?token=' . urlencode($token));
    exit;
}

// Redirect to Google OAuth
$clientId = getenv('GOOGLE_CLIENT_ID');
if (!$clientId) { jsonError('Google OAuth not configured. Set GOOGLE_CLIENT_ID env var.', 503); }
$redirectUri = urlencode('https://opencli.myowncloud.tech/api/oauth-google.php');
$scope = urlencode('email profile');
header("Location: https://accounts.google.com/o/oauth2/v2/auth?client_id={$clientId}&redirect_uri={$redirectUri}&response_type=code&scope={$scope}");
exit;
