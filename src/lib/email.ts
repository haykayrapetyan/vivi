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

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000";

const brandWrap = (inner: string) => `
  <div style="background:#0f1014;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#16181d;border:1px solid #26282f;border-radius:16px;padding:32px;color:#e7e8ea;">
      <img src="${appUrl}/brand/vivi-white.png" alt="Vivi" height="26" style="height:26px;width:auto;margin-bottom:24px;display:block;border:0;outline:none;text-decoration:none;" />
      ${inner}
    </div>
    <div style="max-width:440px;margin:16px auto 0;text-align:center;color:#6b6f76;font-size:12px;">
      Vivi — AI recruiting with video interviews
    </div>
  </div>
`;

export async function sendOtpEmail(to: string, otp: string) {
  const html = brandWrap(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Your Vivi sign-in code. It's valid for 5 minutes.</p>
    <div style="display:inline-block;background:#0f1014;border:1px solid #26282f;border-radius:10px;padding:14px 24px;font-size:28px;font-weight:600;letter-spacing:0.3em;color:#fff;">${otp}</div>
    <p style="margin:24px 0 0;font-size:12px;color:#8a8e96;line-height:1.5;">If you didn't request this code, you can safely ignore this email.</p>
  `);
  await send({
    to,
    subject: `${otp} — your Vivi sign-in code`,
    html,
    text: `Your Vivi sign-in code: ${otp}\nIt's valid for 5 minutes.`,
  });
}

export async function sendOrgInvitationEmail(
  to: string,
  args: { orgName: string; inviterName: string; url: string },
) {
  const html = brandWrap(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;"><b>${args.inviterName}</b> invited you to the <b>${args.orgName}</b> workspace on Vivi.</p>
    <a href="${args.url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:500;">Accept invitation</a>
  `);
  await send({
    to,
    subject: `Invitation to ${args.orgName} — Vivi`,
    html,
    text: `${args.inviterName} invited you to the "${args.orgName}" workspace on Vivi. Accept: ${args.url}`,
  });
}

export async function sendAgentReviewEmail(
  to: string,
  args: {
    candidateName: string;
    vacancyTitle: string;
    aiScore: number | null;
    url: string;
  },
) {
  const score = args.aiScore != null ? ` Fit score: ${args.aiScore}/10.` : "";
  const html = brandWrap(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Your AI recruiter reviewed <b>${args.candidateName}</b> for <b>${args.vacancyTitle}</b>.${score}</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#a7abb3;">The full breakdown is waiting in the vacancy chat.</p>
    <a href="${args.url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:500;">Read the review</a>
  `);
  await send({
    to,
    subject: `Agent reviewed ${args.candidateName} — ${args.vacancyTitle}`,
    html,
    text: `Your AI recruiter reviewed ${args.candidateName} for "${args.vacancyTitle}".${score} Read the breakdown: ${args.url}`,
  });
}

export async function sendInterviewCompletedEmail(
  to: string,
  args: { candidateName: string; vacancyTitle: string; url: string },
) {
  const html = brandWrap(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;"><b>${args.candidateName}</b> completed the video interview for <b>${args.vacancyTitle}</b>.</p>
    <a href="${args.url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:500;">View answers</a>
  `);
  await send({
    to,
    subject: `New interview: ${args.candidateName} — ${args.vacancyTitle}`,
    html,
    text: `${args.candidateName} completed the video interview for "${args.vacancyTitle}". Open: ${args.url}`,
  });
}
