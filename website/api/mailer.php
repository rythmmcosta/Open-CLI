<?php
/**
 * Shared SMTP mailer using PHPMailer.
 * Credentials come from environment variables only — never hardcoded.
 */
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
    use PHPMailer\PHPMailer\PHPMailer;
    use PHPMailer\PHPMailer\Exception as MailException;
    define('PHPMAILER_AVAILABLE', true);
} else {
    define('PHPMAILER_AVAILABLE', false);
}

function sendMail(string $to, string $toName, string $subject, string $htmlBody): bool {
    $smtpHost = getenv('SMTP_HOST') ?: 'mail.myowncloud.tech';
    $smtpUser = getenv('SMTP_USER') ?: 'system@myowncloud.tech';
    $smtpPass = getenv('SMTP_PASS');

    // Try PHPMailer first (SMTP)
    if (PHPMAILER_AVAILABLE && $smtpPass) {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = $smtpHost;
            $mail->SMTPAuth   = true;
            $mail->Username   = $smtpUser;
            $mail->Password   = $smtpPass;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';
            $mail->setFrom($smtpUser, 'Open CLI');
            $mail->addAddress($to, $toName);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $htmlBody;
            $mail->AltBody = strip_tags($htmlBody);
            return $mail->send();
        } catch (MailException $e) {
            error_log('PHPMailer error: ' . $e->getMessage());
            // fall through to php mail()
        }
    }

    // Fallback: php mail()
    $headers  = "From: Open CLI <{$smtpUser}>\r\n";
    $headers .= "Reply-To: {$smtpUser}\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    return mail($to, $subject, $htmlBody, $headers);
}

function otpEmailHtml(string $name, string $otp): string {
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#070b14;color:#e2e8f0;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#0d1421;border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.08);">
    <div style="font-size:1.5rem;font-weight:700;margin-bottom:8px;">&#9889; Open CLI</div>
    <h2 style="color:#00cc7e;margin:0 0 16px;">Verify your email</h2>
    <p style="color:#94a3b8;">Hi {$name}, use this code to verify your Open CLI account:</p>
    <div style="background:#070b14;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
      <span style="font-size:2.5rem;font-weight:700;letter-spacing:0.3em;color:#00cc7e;font-family:monospace;">{$otp}</span>
    </div>
    <p style="color:#64748b;font-size:0.85rem;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">
    <p style="color:#64748b;font-size:0.75rem;">Open CLI — One CLI. Every AI. Zero Limits.</p>
  </div>
</body>
</html>
HTML;
}

function passwordResetEmailHtml(string $name, string $resetUrl): string {
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#070b14;color:#e2e8f0;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#0d1421;border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.08);">
    <div style="font-size:1.5rem;font-weight:700;margin-bottom:8px;">&#9889; Open CLI</div>
    <h2 style="color:#00cc7e;margin:0 0 16px;">Reset your password</h2>
    <p style="color:#94a3b8;">Hi {$name}, click the button below to reset your password:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="{$resetUrl}" style="background:#00cc7e;color:#070b14;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Reset Password</a>
    </div>
    <p style="color:#64748b;font-size:0.85rem;">This link expires in 1 hour. If you didn't request a password reset, ignore this email.</p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">
    <p style="color:#64748b;font-size:0.75rem;">Open CLI — One CLI. Every AI. Zero Limits.</p>
  </div>
</body>
</html>
HTML;
}
