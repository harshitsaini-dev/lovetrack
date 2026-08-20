/**
 * Short video capture for lunch proof.
 *
 * Same principle as the photo path: the clip comes from a live MediaStream
 * via MediaRecorder. There is no file picker, so an existing video cannot be
 * submitted through the UI.
 */

export const LUNCH_MIN_SECONDS = 5;
export const LUNCH_MAX_SECONDS = 20;

/** Ordered by preference; browsers disagree on what they will encode. */
const CANDIDATE_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;

  return (
    CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
  );
}

export function isRecordingSupported(): boolean {
  return pickMimeType() !== null;
}

export type RecordingResult = {
  blob: Blob;
  durationS: number;
  mimeType: string;
};

/**
 * Wraps MediaRecorder so callers deal with start/stop and a promise, rather
 * than event plumbing.
 *
 * The duration is measured here rather than read back from the file: WebM
 * produced by MediaRecorder frequently carries an unknown or wrong duration
 * in its metadata, which would make the length check meaningless.
 */
type RecorderCallbacks = {
  onTick?: (elapsedS: number) => void;
  /** Fires once, whether the user stopped it or the time limit did. */
  onComplete: (result: RecordingResult) => void;
  onError?: (error: Error) => void;
};

export class LunchRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private hardStop: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly stream: MediaStream,
    private readonly callbacks: RecorderCallbacks,
  ) {}

  start(): void {
    const mimeType = pickMimeType();
    if (!mimeType) throw new Error("recording_unsupported");

    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: 1_000_000, // ~2.5MB for 20s, comfortably small
    });

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };

    // Reporting completion through a callback rather than a promise means
    // the caller does not have to watch the clock to notice the automatic
    // stop — both endings arrive the same way.
    this.recorder.onstop = () => {
      const durationS = (Date.now() - this.startedAt) / 1000;
      const blob = new Blob(this.chunks, { type: mimeType });
      this.cleanup();
      this.callbacks.onComplete({ blob, durationS, mimeType });
    };

    this.recorder.onerror = () => {
      this.cleanup();
      this.callbacks.onError?.(new Error("recording_failed"));
    };

    this.startedAt = Date.now();
    this.recorder.start(250);

    this.ticker = setInterval(() => {
      this.callbacks.onTick?.((Date.now() - this.startedAt) / 1000);
    }, 200);

    // Stop ourselves at the limit rather than trusting the user to; an
    // over-long clip would be rejected server-side anyway, after they had
    // already waited for it to upload.
    this.hardStop = setTimeout(() => this.stop(), LUNCH_MAX_SECONDS * 1000);
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
  }

  private cleanup(): void {
    if (this.hardStop) clearTimeout(this.hardStop);
    if (this.ticker) clearInterval(this.ticker);
    this.hardStop = null;
    this.ticker = null;
    this.recorder = null;
  }
}
