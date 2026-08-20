const ERRORS: Record<string, string> = {
  not_authenticated: "Session expire ho gaya. Dobara login karein.",
  account_suspended: "Aapka account suspend hai.",
  lunch_needs_check_in: "Pehle check-in karein.",
  lunch_not_finished: "Pehle lunch end karein, phir proof record karein.",
  proof_already_recorded: "Aaj ka lunch proof pehle hi save ho chuka hai.",
  clip_too_short: "Video bahut chhoti hai. Kam se kam 5 second record karein.",
  invalid_proof: "Video valid nahi hai. Dobara record karein.",
  proof_save_failed: "Proof save nahi ho paya. Dobara try karein.",
};

export function getLunchErrorMessage(code: string): string {
  return ERRORS[code] ?? "Kuch galat ho gaya. Dobara try karein.";
}
