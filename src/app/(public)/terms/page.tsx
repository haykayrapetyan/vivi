import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service — Vivi" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 12, 2026">
      <LegalSection title="1. The service">
        Vivi provides tools for creating job postings with AI assistance,
        collecting applications, running asynchronous video interviews, and
        AI-assisted screening of candidates. By creating an account or
        applying to a vacancy you agree to these terms.
      </LegalSection>

      <LegalSection title="2. Accounts">
        You are responsible for activity under your account and for keeping
        access to your sign-in email secure. Workspace members you invite get
        access to your company’s vacancies and candidate data.
      </LegalSection>

      <LegalSection title="3. Acceptable use">
        Don’t use Vivi to post misleading or discriminatory vacancies, to
        collect data you have no right to collect, or to attempt to break,
        probe or overload the service. We may suspend accounts that violate
        these rules.
      </LegalSection>

      <LegalSection title="4. AI output">
        AI-generated content — vacancy drafts, transcripts, candidate
        assessments and assistant messages — may contain errors and is
        provided as a starting point, not as professional advice. Recruiters
        must review AI assessments before acting on them; hiring decisions are
        yours, and you are responsible for compliance with employment and
        anti-discrimination laws in your jurisdiction.
      </LegalSection>

      <LegalSection title="5. Candidate content">
        Recruiters own the relationship with their candidates and are
        responsible for having a lawful basis to collect and review candidate
        applications and recordings. Candidates retain rights to their own
        recordings as described in the Privacy Policy.
      </LegalSection>

      <LegalSection title="6. Availability and changes">
        The service is provided “as is”, without warranties of uninterrupted
        availability. We may modify or discontinue features; we’ll use
        reasonable efforts to notify you about material changes.
      </LegalSection>

      <LegalSection title="7. Liability">
        To the maximum extent permitted by law, Vivi is not liable for
        indirect or consequential damages, lost profits, or hiring outcomes.
        Our aggregate liability is limited to the amounts you paid for the
        service in the 12 months preceding the claim.
      </LegalSection>

      <LegalSection title="8. Termination">
        You can stop using the service and delete your data at any time. We
        may terminate accounts that breach these terms. Sections that by their
        nature should survive termination do so.
      </LegalSection>

      <LegalSection title="9. Contact">
        Questions about these terms: hello@vivi.app.
      </LegalSection>
    </LegalPage>
  );
}
