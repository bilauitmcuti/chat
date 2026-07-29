export const SUGGESTIONS_GROUP_A = [
  "Bila kuliah bermula semester ini?",
  "Lecture 1 — bila mula?",
  "Bilakah Lecture 2 bermula?",
  "Lecture 3 bermula bila?",
  "Minggu kuliah terakhir bila?",
  "Ujian Pertengahan Semester bila?",
  "Cuti Pertengahan Semester bila?",
  "Cuti Khas Aidil Fitri bila?",
  "Minggu Ulangkaji bila?",
  "Peperiksaan Akhir bila?",
  "Peperiksaan minggu akhir bila?",
  "Bila boleh cetak slip menduduki peperiksaan?",
  "Cuti Semester bermula bila?",
  "Cuti semester panjang bila?",
  "Proses Entrance Survey bila?",
  "Exit Survey bila?",
  "SuFO — bila perlu siap?",
  "MDS (Minggu Destini Siswa) bila?",
  "Pendaftaran online Asasi UiTM bila?",
  "Pendaftaran fizikal pelajar baharu bila?",
  "Pendaftaran kursus pelajar baharu dan lama bila?",
  "Validasi kursus berdaftar semester ini bila?",
  "Bila akhir bayar yuran?",
  "Ada tarikh berkaitan penangguhan yuran?",
  "Serahan dokumen pelajar baharu Asasi bila?",
  "Persetujuan tawaran UiTM Asasi bila?",
  "Muat naik gambar kad pelajar iStudent — bila akhir?",
  "Gugur Taraf (GT) bila berlaku?",
  "Permohonan RPGT bila?",
  "Gugur Taraf Muktamad bila?",
];

export const SUGGESTIONS_GROUP_B = [
  "Kuliah semester ini bermula bila?",
  "Lecture 1 bila?",
  "Bila mula Lecture 2?",
  "Bilakah Lecture 3?",
  "Minggu lecture terakhir bila?",
  "Cuti Pertengahan Semester atau cuti perayaan bila?",
  "Minggu Ulangkaji bila?",
  "EET Speaking bila?",
  "Peperiksaan Akhir atau EET Bertulis bila?",
  "Peperiksaan minggu akhir bila?",
  "Slip menduduki peperiksaan — bila boleh cetak?",
  "Short Semester bila?",
  "Lecture intersesi atau peperiksaan Short Semester bila?",
  "Cuti Semester bermula bila?",
  "Cuti Krismas atau tahun baharu bila?",
  "Entrance Survey bila?",
  "Exit Survey bila?",
  "MDS dan Edu 5.0@UiTM bila?",
  "MDS (Minggu Destini Siswa) bila?",
  "Pendaftaran online pelajar sepenuh masa bila?",
  "Pendaftaran fizikal & serahan dokumen pelajar baharu bila?",
  "Pendaftaran kursus ePJJ atau PLK bila?",
  "Validasi kursus berdaftar bila?",
  "Akhir bayar yuran bila?",
  "Tarikh berkaitan penangguhan yuran?",
  "Pendaftaran kolej penginapan pelajar baharu bila?",
  "Persetujuan tawaran UiTM online bila?",
  "Gambar kad pelajar iStudent — tarikh akhir?",
  "GT bila berlaku?",
  "Gugur Taraf Muktamad bila?",
];

/** General UiTM calendar questions — mixed into carousel for Group A and Group B. */
export const SUGGESTIONS_GENERAL = [
  "List semua week 1-14 untuk semester ini",
  "Cuti atau peperiksaan seterusnya bila pada kalendar semester ini?",
  "Minggu Ulangkaji dan Peperiksaan Akhir — maksudnya apa dalam kalendar?",
  "Penangguhan yuran (Fee Deferment) — tarikh apa dalam kalendar?",
  "Apa beza cuti pertengahan semester dengan cuti umum?",
];

const DISPLAY_COUNT = 8;
const GROUP_PICK_COUNT = 4;
const GENERAL_PICK_COUNT = DISPLAY_COUNT - GROUP_PICK_COUNT;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function pickFromPool(pool: string[], count: number, exclude: string[]): string[] {
  const available = pool.filter((s) => !exclude.includes(s));
  const source = available.length >= count ? available : pool;
  return shuffle(source).slice(0, count);
}

export function getRandomSuggestions(group: "A" | "B", exclude: string[]): string[] {
  const groupPool = group === "A" ? SUGGESTIONS_GROUP_A : SUGGESTIONS_GROUP_B;
  const groupPicks = pickFromPool(groupPool, GROUP_PICK_COUNT, exclude);
  const generalPicks = pickFromPool(SUGGESTIONS_GENERAL, GENERAL_PICK_COUNT, [
    ...exclude,
    ...groupPicks,
  ]);
  const picks = shuffle([...groupPicks, ...generalPicks]);
  if (picks.length >= DISPLAY_COUNT) return picks;

  const fallback = [...groupPool, ...SUGGESTIONS_GENERAL].filter(
    (s) => !exclude.includes(s)
  );
  const pool = fallback.length >= DISPLAY_COUNT ? fallback : [...groupPool, ...SUGGESTIONS_GENERAL];
  return shuffle(pool).slice(0, DISPLAY_COUNT);
}
