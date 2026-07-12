import type { Lang } from "@/i18n/dict";

export const STATUS_NOTE_MAX = 60;

export const STATUS_NOTE_DURATION_OPTIONS = [
  { value: "none", label: "Until I change it" },
  { value: "3d", label: "3 days" },
  { value: "1w", label: "1 week" },
  { value: "15d", label: "15 days" },
  { value: "1m", label: "1 month" },
] as const;

export type StatusNoteDuration = (typeof STATUS_NOTE_DURATION_OPTIONS)[number]["value"];
export type TimedStatusNoteDuration = Exclude<StatusNoteDuration, "none">;

type StatusNoteShape = {
  status_message: string | null;
  status_message_expires_at?: string | null;
};

export function isStatusNoteExpired(expiresAt?: string | null, now = new Date()) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function getVisibleStatusMessage<T extends StatusNoteShape>(record: T | null | undefined) {
  if (!record?.status_message) return null;
  return isStatusNoteExpired(record.status_message_expires_at) ? null : record.status_message;
}

export function normalizeStatusNote<T extends StatusNoteShape>(record: T): T {
  if (!isStatusNoteExpired(record.status_message_expires_at)) return record;
  return {
    ...record,
    status_message: null,
    status_message_expires_at: null,
  };
}

export function buildStatusNoteExpiry(duration: StatusNoteDuration, now = new Date()) {
  if (duration === "none") return null;
  const expiresAt = new Date(now);

  if (duration === "3d") expiresAt.setDate(expiresAt.getDate() + 3);
  if (duration === "1w") expiresAt.setDate(expiresAt.getDate() + 7);
  if (duration === "15d") expiresAt.setDate(expiresAt.getDate() + 15);
  if (duration === "1m") expiresAt.setMonth(expiresAt.getMonth() + 1);

  return expiresAt.toISOString();
}

export function getStatusNoteDurationOptions(lang: Lang = "en") {
  return STATUS_NOTE_DURATION_OPTIONS.map((option) => ({
    ...option,
    label: getStatusNoteDurationLabel(option.value, lang),
  }));
}

export function getStatusNoteDurationLabel(duration: StatusNoteDuration, lang: Lang = "en") {
  if (lang === "es") {
    if (duration === "none") return "Hasta que la cambie";
    if (duration === "3d") return "3 días";
    if (duration === "1w") return "1 semana";
    if (duration === "15d") return "15 días";
    if (duration === "1m") return "1 mes";
  }
  return STATUS_NOTE_DURATION_OPTIONS.find((option) => option.value === duration)?.label ?? "Until I change it";
}
