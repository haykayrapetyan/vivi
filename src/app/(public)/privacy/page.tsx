import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy — Vivi" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 12, 2026">
      <LegalSection title="1. Who we are">
        Vivi is an AI-powered recruiting service that helps companies create
        job postings, collect candidate applications and run asynchronous
        video interviews. This policy explains what data we collect, why, and
        how it is handled — both for recruiters using the dashboard and for
        candidates applying to a vacancy.
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <strong>From recruiters:</strong> your email address and name (for
        sign-in via magic link), your company profile (name, website, logo,
        description) and the vacancies you create, including chat history with
        the AI assistant.
        <br />
        <br />
        <strong>From candidates:</strong> the name, email and optional phone
        number you submit when applying, and the video recordings you make
        during the interview, including a still frame used as your profile
        picture. We also store machine-generated transcripts of your answers
        and AI-generated evaluations of your interview.
      </LegalSection>

      <LegalSection title="3. How AI is involved">
        Vivi uses large language models (currently provided by OpenAI) to
        draft vacancy descriptions, transcribe interview answers, and produce
        candidate assessments. An autonomous AI assistant reviews completed
        interviews and summarizes them for the recruiter. AI assessments are
        advisory only — hiring decisions are made by people, and recruiters
        see your full answers, not just the AI’s summary. Your data is sent to
        these providers solely to deliver the service and is not used by us to
        train models.
      </LegalSection>

      <LegalSection title="4. Where data lives">
        Application data is stored in our database; video recordings and
        images are stored in Cloudflare R2 object storage and served only via
        short-lived signed URLs to authorized members of the hiring company.
        Transactional emails are delivered through Resend. We use
        industry-standard encryption in transit.
      </LegalSection>

      <LegalSection title="5. Cookies">
        We use a single session cookie to keep you signed in. No advertising
        or cross-site tracking cookies.
      </LegalSection>

      <LegalSection title="6. Retention and deletion">
        Vacancy and candidate data is kept while the recruiter’s account and
        vacancy exist. Deleting a vacancy deletes its candidates, recordings
        and transcripts. Candidates can request deletion of their data at any
        time by contacting the company they applied to, or us directly.
      </LegalSection>

      <LegalSection title="7. Your rights">
        You may request access to, correction of, or deletion of your personal
        data. Recruiters are responsible for ensuring they have a lawful basis
        to process the candidate data they collect through Vivi.
      </LegalSection>

      <LegalSection title="8. Contact">
        Questions about this policy: hello@vivi.app. We may update this policy
        from time to time; material changes will be reflected on this page
        with a new date.
      </LegalSection>
    </LegalPage>
  );
}
