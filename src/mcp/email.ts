import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const emailTools: ToolDef[] = [
  {
    name: 'email_send',
    description: 'Send an email via SMTP using a connection URL (e.g. smtp://user:pass@smtp.gmail.com:587).',
    inputSchema: {
      type: 'object',
      properties: {
        smtpUrl: { type: 'string', description: 'SMTP connection URL, e.g. smtp://user:pass@smtp.gmail.com:587' },
        to:      { type: 'string', description: 'Recipient email address (or comma-separated list)' },
        subject: { type: 'string', description: 'Email subject line' },
        body:    { type: 'string', description: 'Email body content' },
        html:    { type: 'boolean', description: 'Treat body as HTML (default: false, sends plain text)' },
      },
      required: ['smtpUrl', 'to', 'subject', 'body'],
    },
  },
  {
    name: 'email_check_config',
    description: 'Verify that an SMTP connection URL is reachable and credentials are accepted.',
    inputSchema: {
      type: 'object',
      properties: {
        smtpUrl: { type: 'string', description: 'SMTP connection URL to verify' },
      },
      required: ['smtpUrl'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helper — dynamic nodemailer require
// ---------------------------------------------------------------------------

interface Transporter {
  sendMail(opts: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId: string; response: string }>;
  verify(): Promise<boolean>;
  close(): void;
}

async function getTransport(smtpUrl: string): Promise<Transporter> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer') as {
      createTransport(url: string): Transporter;
    };
    return nodemailer.createTransport(smtpUrl);
  } catch {
    throw new Error('nodemailer not installed. Run: npm install nodemailer');
  }
}

/** Extract the user part from an SMTP URL to use as the "from" address. */
function fromAddress(smtpUrl: string): string {
  try {
    const u = new URL(smtpUrl);
    const user = decodeURIComponent(u.username);
    return user.includes('@') ? user : `${user}@${u.hostname}`;
  } catch {
    return 'noreply@localhost';
  }
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeEmailTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const smtpUrl = input.smtpUrl as string;

    // -----------------------------------------------------------------------
    if (name === 'email_send') {
      const to      = input.to      as string;
      const subject = input.subject as string;
      const body    = input.body    as string;
      const html    = (input.html   as boolean | undefined) || false;

      const transport = await getTransport(smtpUrl);
      try {
        const from = fromAddress(smtpUrl);
        const info = await transport.sendMail({
          from,
          to,
          subject,
          ...(html ? { html: body } : { text: body }),
        });
        return {
          output: [
            `Email sent successfully.`,
            `  Message-ID : ${info.messageId}`,
            `  From       : ${from}`,
            `  To         : ${to}`,
            `  Subject    : ${subject}`,
            `  Format     : ${html ? 'HTML' : 'Plain text'}`,
            `  Response   : ${info.response}`,
          ].join('\n'),
          isError: false,
        };
      } finally {
        transport.close();
      }
    }

    // -----------------------------------------------------------------------
    if (name === 'email_check_config') {
      const transport = await getTransport(smtpUrl);
      try {
        await transport.verify();
        return {
          output: `SMTP connection verified successfully.\nURL: ${smtpUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')}`,
          isError: false,
        };
      } finally {
        transport.close();
      }
    }

    return { output: `Unknown email tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
