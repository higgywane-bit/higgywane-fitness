/*
 * Outgoing email. Console mailer by default (logs, sends nothing); set RESEND_API_KEY
 * and EMAIL_FROM to send for real through Resend. Swap the provider here only.
 * TODO: confirm with owner (sending domain, e.g. hello@superfit.co.th)
 */

export type Email = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  readonly name: string;
  readonly live: boolean;
  send(email: Email): Promise<void>;
}

const consoleMailer: Mailer = {
  name: "Preview only (not sending)",
  live: false,
  async send(e) {
    console.info(`[email] to=${e.to} subject="${e.subject}"`);
  },
};

function resendMailer(key: string, from: string): Mailer {
  return {
    name: "Resend",
    live: true,
    async send(e) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: e.to, subject: e.subject, text: e.text, html: e.html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    },
  };
}

export function getMailer(): Mailer {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return key && from ? resendMailer(key, from) : consoleMailer;
}
