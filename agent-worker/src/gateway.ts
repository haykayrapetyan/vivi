// Typed client for the Next.js agent gateway (/api/agent-gateway/*) — the
// agent's "hands". All Postgres/R2/Whisper/Resend work happens app-side;
// the worker only thinks and orchestrates.

import type {
  CandidateDetail,
  NotifyRequest,
  VacancyContext,
} from "../../src/lib/agent/gateway-types";

export class Gateway {
  constructor(
    private baseUrl: string,
    private secret: string,
  ) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(
      `${this.baseUrl.replace(/\/$/, "")}/api/agent-gateway/${path}`,
      {
        ...init,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.secret}`,
          ...init?.headers,
        },
      },
    );
    if (!res.ok) {
      throw new Error(`gateway ${path} → ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  getContext(vacancyId: string): Promise<VacancyContext> {
    return this.req(`vacancy/${vacancyId}/context`);
  }

  getCandidate(
    vacancyId: string,
    candidateId: string,
  ): Promise<CandidateDetail> {
    return this.req(`vacancy/${vacancyId}/candidate/${candidateId}`);
  }

  /** Runs transcription backfill + AI evaluation, returns the fresh profile. */
  evaluateCandidate(
    vacancyId: string,
    candidateId: string,
  ): Promise<CandidateDetail> {
    return this.req(`vacancy/${vacancyId}/candidate/${candidateId}/evaluate`, {
      method: "POST",
    });
  }

  postMessage(vacancyId: string, content: string): Promise<{ ok: boolean }> {
    return this.req(`vacancy/${vacancyId}/message`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  notify(vacancyId: string, body: NotifyRequest): Promise<{ ok: boolean }> {
    return this.req(`vacancy/${vacancyId}/notify`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}
