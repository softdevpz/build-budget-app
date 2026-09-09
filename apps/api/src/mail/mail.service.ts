import { Injectable } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

const RESEND_API_URL = 'https://api.resend.com/emails';

@Injectable()
export class MailService {
  // Railway blocks outbound SMTP (465 and 587 both time out), so production
  // sends over Resend's HTTPS API instead — plain fetch, no new dependency.
  // Locally, RESEND_API_KEY is unset and we fall back to SMTP against Mailpit,
  // which has no HTTP API of its own.
  private readonly resendApiKey = process.env.RESEND_API_KEY;

  private readonly transporter: Transporter | undefined = this.resendApiKey
    ? undefined
    : createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: Number(process.env.SMTP_PORT ?? 1025) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });

  async sendMail(to: string, subject: string, text: string, html?: string) {
    if (this.resendApiKey) {
      return this.sendViaResendApi(to, subject, text, html);
    }
    return this.transporter!.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
  }

  private async sendViaResendApi(to: string, subject: string, text: string, html?: string) {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend API error (${res.status}): ${body}`);
    }
  }
}
