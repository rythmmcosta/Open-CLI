<?php
// ============================================================
// Open CLI Admin — Malware / Suspicious Content Scanner
// POST { sync_package_id: N }
// ============================================================

require_once __DIR__ . '/admin-config.php';
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') adminJsonError('Method not allowed', 405);

$body = adminGetBody();
if (empty($body['sync_package_id'])) adminJsonError('sync_package_id required', 400);

$packageId   = (int) $body['sync_package_id'];
$pdo         = db();
$storageRoot = rtrim(getenv('OPENCLI_STORAGE_ROOT') ?: (sys_get_temp_dir() . '/opencli_uploads'), '/');

// ── Fetch package row ────────────────────────────────────────
$stmt = $pdo->prepare('SELECT * FROM sync_packages WHERE id = ?');
$stmt->execute([$packageId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) adminJsonError('Package not found', 404);

$archivePath = $storageRoot . '/' . $row['user_id'] . '/' . $row['project_hash'] . '.tar.gz';

if (!file_exists($archivePath)) {
    adminJsonError('Archive file not found on disk: ' . $archivePath, 404);
}

// ── Extract to temp dir ──────────────────────────────────────
$tmpDir = '/tmp/scan_' . uniqid('', true);
if (!mkdir($tmpDir, 0700, true)) {
    adminJsonError('Failed to create temp directory', 500);
}

$output  = [];
$retval  = 0;
exec('tar -xzf ' . escapeshellarg($archivePath) . ' -C ' . escapeshellarg($tmpDir) . ' 2>&1', $output, $retval);

if ($retval !== 0) {
    exec('rm -rf ' . escapeshellarg($tmpDir));
    adminJsonError('Failed to extract archive: ' . implode(' ', $output), 500);
}

// ── Scan for suspicious patterns ────────────────────────────
$suspicious = [];
$scannedFiles = 0;
$patterns = [
    'eval(base64_decode',
    'shell_exec(',
    'system(',
    'passthru(',
    'exec(',
    'proc_open(',
    'popen(',
    '`',                         // backtick shell execution
    'file_put_contents(',        // file write
    'base64_decode(',
    'str_rot13(',
    'assert(',
    'preg_replace.*\/e',
    'create_function(',
];

try {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($tmpDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (!$file->isFile()) continue;

        // Skip large files (> 5 MB) and binary files
        $size = $file->getSize();
        if ($size > 5 * 1024 * 1024) continue;

        $content = @file_get_contents($file->getPathname());
        if ($content === false) continue;

        $scannedFiles++;

        foreach ($patterns as $pattern) {
            if (stripos($content, $pattern) !== false) {
                $relativePath = str_replace($tmpDir, '', $file->getPathname());
                $suspicious[] = [
                    'file'    => $relativePath,
                    'pattern' => $pattern,
                ];
            }
        }
    }
} finally {
    // Always clean up temp dir
    exec('rm -rf ' . escapeshellarg($tmpDir));
}

$count      = count($suspicious);
$riskLevel  = $count > 5 ? 'high' : ($count > 0 ? 'medium' : 'low');

adminJsonResponse([
    'package_id'       => $packageId,
    'project_name'     => $row['project_name'],
    'archive_path'     => $archivePath,
    'scanned_files'    => $scannedFiles,
    'suspicious_files' => $suspicious,
    'suspicious_count' => $count,
    'risk_level'       => $riskLevel,
    'scanned_at'       => date('c'),
]);
