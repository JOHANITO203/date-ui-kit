import { env } from "../config/env";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

const sendViaSMTP = async (payload: EmailPayload): Promise<void> => {
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
};

const logEmail = (payload: EmailPayload): void => {
  // DEV ONLY: prints the full email (including the single-use token link) so a
  // developer can complete the flow locally without SMTP. Never used in prod.
  console.log(
    `[emailService] DEV — email not sent (no SMTP config)\n  to: ${payload.to}\n  subject: ${payload.subject}\n  html: ${payload.html}`,
  );
};

export const sendEmail = async (payload: EmailPayload): Promise<void> => {
  if (env.hasSmtp) {
    await sendViaSMTP(payload);
    return;
  }
  // SECURITY: auth emails carry single-use login tokens. Logs are a credential
  // sink, so in production we fail closed instead of logging the token. Configure
  // SMTP_* for production email delivery.
  if (env.NODE_ENV === "production") {
    throw new Error("SMTP not configured: refusing to emit auth email token via logs in production.");
  }
  logEmail(payload);
};

export const sendMagicLink = async (email: string, rawToken: string, from: string): Promise<void> => {
  const link = `${env.APP_URL}/auth/callback?token_hash=${rawToken}&type=magiclink&from=${encodeURIComponent(from)}`;
  await sendEmail({
    to: email,
    subject: "Votre lien de connexion Exotic",
    html: `<p>Cliquez sur ce lien pour vous connecter (valable 15 minutes) :</p><p><a href="${link}">${link}</a></p>`,
  });
};

export const sendSignupVerification = async (email: string, rawToken: string): Promise<void> => {
  const link = `${env.APP_URL}/auth/callback?token_hash=${rawToken}&type=signup`;
  await sendEmail({
    to: email,
    subject: "Vérifiez votre adresse email — Exotic",
    html: `<p>Cliquez sur ce lien pour confirmer votre inscription (valable 24 heures) :</p><p><a href="${link}">${link}</a></p>`,
  });
};
