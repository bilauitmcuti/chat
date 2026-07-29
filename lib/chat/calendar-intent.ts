export type CalendarContextIntent =
  | "all"
  | "break"
  | "exam"
  | "lecture"
  | "registration"
  | "fee"
  | "revision"
  | "gugur"
  | "days_until"
  | "lecture_count"
  | "festive";

const FEE_HINTS = [
  "gt",
  "gt2",
  "rpgt",
  "yuran",
  "fee",
  "payment",
  "bayaran",
  "pembayaran",
  "penangguhan",
  "deferment",
];
const STUDY_FEE_HINTS = [
  "yuran pengajian",
  "yuran kolej",
  "bilik berdua",
  "bilik bertiga",
  "bilik berempat",
  "barang elektrik",
  "senarai yuran",
  "tuition fee",
  "college fee",
  "hostel fee",
  "yuran diploma",
  "yuran degree",
  "yuran ijazah",
];
const REGISTRATION_HINTS = [
  "registration",
  "pendaftaran",
  "validation",
  "sahkan",
  "add/drop",
  "tambah/gugur",
  "late add",
];
const LECTURE_HINTS = ["lecture", "kuliah", "minggu kuliah", "lecture week"];
const REVISION_HINTS = ["revision", "ulangkaji", "minggu ulangkaji"];
const GUGUR_HINTS = ["gugur taraf", "deregistration"];
const EXAM_HINTS = [
  "exam",
  "peperiksaan",
  "ujian",
  "examination",
  "slip",
  "eet",
];
const BREAK_HINTS = ["break", "cuti", "recess", "holiday"];
const FESTIVE_HINTS = ["hari raya", "aidil", "festive", "recess"];
const DAYS_UNTIL_HINTS = [
  "how many days",
  "berapa hari",
  "days until",
  "days till",
  "berapa lama lagi",
];
const LECTURE_COUNT_HINTS = [
  "how many lecture",
  "berapa minggu kuliah",
  "how many weeks",
  "lecture weeks",
];

export function resolveCalendarContextIntent(message: string): CalendarContextIntent {
  const lower = message.toLowerCase().trim();
  if (!lower) return "all";

  if (DAYS_UNTIL_HINTS.some((h) => lower.includes(h))) return "days_until";
  if (LECTURE_COUNT_HINTS.some((h) => lower.includes(h))) return "lecture_count";
  if (STUDY_FEE_HINTS.some((h) => lower.includes(h))) return "all";
  if (FEE_HINTS.some((h) => lower.includes(h))) return "fee";
  if (GUGUR_HINTS.some((h) => lower.includes(h))) return "gugur";
  if (REVISION_HINTS.some((h) => lower.includes(h))) return "revision";
  if (FESTIVE_HINTS.some((h) => lower.includes(h))) return "festive";
  if (REGISTRATION_HINTS.some((h) => lower.includes(h))) return "registration";
  if (EXAM_HINTS.some((h) => lower.includes(h))) return "exam";
  if (BREAK_HINTS.some((h) => lower.includes(h))) return "break";
  if (LECTURE_HINTS.some((h) => lower.includes(h))) return "lecture";

  return "all";
}

export function isNarrowCalendarIntent(intent: CalendarContextIntent): boolean {
  return intent !== "all";
}
