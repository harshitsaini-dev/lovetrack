import type { AttendanceEventType } from "@/types/attendance";

/**
 * What the user is asked to say on camera.
 *
 * The phrase names their partner: "Hello, Priya" rather than a random
 * code. It reads like something a person would actually say, which is the
 * point — a capture that feels like a message to someone is a different
 * experience from reciting a serial number at a lens.
 *
 * On its security value, plainly: this was never proof. Nothing verifies
 * the phrase was spoken — that would need liveness detection, which is out
 * of scope. It is a deterrent against holding up an old photo, and naming
 * a partner makes it a slightly weaker one than a rotating code would be,
 * because it does not change day to day.
 *
 * That trade is deliberate. The controls that actually do the work are the
 * single-use nonce, the live camera stream and the freshness of the
 * location fix; the phrase was always the softest of them.
 */

const FALLBACK_NAME = "apne partner";

function firstName(fullName: string | null | undefined): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

export type Challenge = {
  /** Shown over the camera preview — short, readable at a glance. */
  overlay: string;
  /** The fuller instruction above it. */
  instruction: string;
};

export function getChallenge(
  eventType: AttendanceEventType,
  partnerName: string | null,
): Challenge {
  const name = firstName(partnerName);

  if (eventType === "lunch_end") {
    return {
      overlay: name ? `Khana khalo, ${name}` : "Khana khalo",
      instruction: name
        ? `Camera me khana dikhayein aur bolein: "Khana khalo, ${name}"`
        : `Camera me khana dikhayein aur bolein: "Khana khalo"`,
    };
  }

  return {
    overlay: name ? `Hello, ${name}` : "Hello",
    instruction: name
      ? `Camera me dekhkar bolein: "Hello, ${name}"`
      : `Camera me dekhkar bolein: "Hello"`,
  };
}

/** The lunch clip has its own instruction, since it is a video not a photo. */
export function getLunchVideoChallenge(partnerName: string | null): Challenge {
  const name = firstName(partnerName) ?? FALLBACK_NAME;

  return {
    overlay: `Khana khate hue: "Khana khalo, ${name}"`,
    instruction: `Khana khate hue video banayein aur bolein: "Khana khalo, ${name}"`,
  };
}
