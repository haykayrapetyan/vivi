import { Resend } from "resend";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const isProd = () => process.env.NODE_ENV === "production";

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function logDevEmail(to: string, subject: string, text?: string) {
  console.log("\n📧 [email:dev] not sent — logging instead:");
  console.log(`   to: ${to}`);
  console.log(`   subject: ${subject}`);
  if (text) console.log(`   text:\n${text}\n`);
}

export async function send({ to, subject, html, text }: SendArgs) {
  const resend = getResend();
  const from = process.env.EMAIL_FROM ?? "Vivi <onboarding@resend.dev>";

  if (!resend) {
    // No API key configured — log instead of sending.
    logDevEmail(to, subject, text);
    return;
  }

  const { error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) {
    console.error("[email] Resend error:", error.message);
    // In development, don't block the flow (e.g. Resend's sandbox sender only
    // delivers to the account owner). Log the content so the link is usable.
    if (!isProd()) {
      console.warn(
        "[email:dev] Resend failed — falling back to console so the flow continues.",
      );
      logDevEmail(to, subject, text);
      return;
    }
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

const brandWrap = (inner: string) => `
  <div style="background:#0f1014;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#16181d;border:1px solid #26282f;border-radius:16px;padding:32px;color:#e7e8ea;">
      <div style="font-size:18px;font-weight:600;letter-spacing:-0.02em;margin-bottom:24px;color:#fff;">Vivi</div>
      ${inner}
    </div>
    <div style="max-width:440px;margin:16px auto 0;text-align:center;color:#6b6f76;font-size:12px;">
      Vivi — AI-рекрутинг с видеоинтервью
    </div>
  </div>
`;

export async function sendMagicLinkEmail(to: string, url: string) {
  const html = brandWrap(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Нажмите кнопку ниже, чтобы войти в Vivi. Ссылка действует 5 минут.</p>
    <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:500;">Войти в Vivi</a>
    <p style="margin:24px 0 0;font-size:12px;color:#8a8e96;line-height:1.5;">Если кнопка не работает, скопируйте ссылку:<br/><a href="${url}" style="color:#818cf8;word-break:break-all;">${url}</a></p>
  `);
  await send({
    to,
    subject: "Вход в Vivi",
    html,
    text: `Войдите в Vivi по ссылке (действует 5 минут):\n${url}`,
  });
}

export async function sendOrgInvitationEmail(
  to: string,
  args: { orgName: string; inviterName: string; url: string },
) {
  const html = brandWrap(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;"><b>${args.inviterName}</b> приглашает вас в команду <b>${args.orgName}</b> в Vivi.</p>
    <a href="${args.url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:500;">Принять приглашение</a>
  `);
  await send({
    to,
    subject: `Приглашение в команду ${args.orgName} — Vivi`,
    html,
    text: `${args.inviterName} приглашает вас в команду «${args.orgName}» в Vivi. Принять: ${args.url}`,
  });
}

export async function sendInterviewCompletedEmail(
  to: string,
  args: { candidateName: string; vacancyTitle: string; url: string },
) {
  const html = brandWrap(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;"><b>${args.candidateName}</b> завершил(а) видеоинтервью на вакансию <b>${args.vacancyTitle}</b>.</p>
    <a href="${args.url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:500;">Посмотреть ответы</a>
  `);
  await send({
    to,
    subject: `Новое интервью: ${args.candidateName} — ${args.vacancyTitle}`,
    html,
    text: `${args.candidateName} завершил видеоинтервью на «${args.vacancyTitle}». Откройте: ${args.url}`,
  });
}
