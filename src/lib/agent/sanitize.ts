// Helpers to safely embed candidate-provided content (transcripts, names)
// into LLM prompts. Candidate text is untrusted: it may contain prompt
// injection ("ignore previous instructions…"), so it is always cleaned and
// fenced in explicit data tags the system prompt tells the model to distrust.

// All C0 control chars except \t \n \r, plus DEL.
const CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strips control characters and caps length for prompt embedding. */
export function cleanUntrusted(text: string, maxLen = 6000): string {
  const cleaned = text.replace(CONTROL_CHARS, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen)}… [truncated]`;
}

/**
 * Wraps untrusted text in a fenced data block. The tag is referenced by the
 * agent system prompt: content inside is data, never instructions.
 */
export function untrustedBlock(label: string, text: string): string {
  const safe = cleanUntrusted(text).replaceAll("</candidate_data>", "");
  return `<candidate_data label="${label.replace(/"/g, "'")}">\n${safe}\n</candidate_data>`;
}
