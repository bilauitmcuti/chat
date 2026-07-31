export const SUGGESTIONS_GROUP_A = [
  "Kuliah semester ni start bila?",
  "Tarikh mula Lecture 1-3?",
  "Minggu kuliah last semester ni bila?",
  "Bila ujian pertengahan semester?",
  "Cuti Pertengahan Semester tarikh apa?",
  "Minggu Ulangkaji start bila?",
  "Peperiksaan Akhir tarikh apa?",
  "Slip peperiksaan boleh cetak dari tarikh mana?",
  "Cuti Semester (termasuk cuti panjang) tarikh apa?",
  "Entrance Survey dan Exit Survey — bila & deadline?",
  "SuFO kena siap sebelum tarikh apa?",
  "MDS (Minggu Destini Siswa) tarikh apa?",
  "Pendaftaran Asasi UiTM (online & fizikal) tarikh apa?",
  "Pendaftaran & validasi kursus semester ni tarikh apa?",
  "Bayar yuran last day dan penangguhan yuran — deadline apa?",
  "Serahan dokumen & persetujuan tawaran Asasi tarikh apa?",
  "Bila perlu upload gambar kad pelajar iStudent?",
  "Gugur Taraf (GT), RPGT dan Gugur Taraf Muktamad — tarikh apa?",
];

export const SUGGESTIONS_GROUP_B = [
  "Kuliah semester ni start tarikh berapa?",
  "Tarikh mula Lecture 1-3?",
  "Minggu lecture last semester ni tarikh apa?",
  "Cuti Pertengahan Semester tarikh apa?",
  "Minggu Ulangkaji start tarikh apa?",
  "EET Speaking, Peperiksaan Akhir atau EET Bertulis — tarikh apa?",
  "Slip peperiksaan boleh cetak dari tarikh mana?",
  "Short Semester (kuliah intersesi & peperiksaan) tarikh apa?",
  "Bila cuti semester akan bermula?",
  "Entrance Survey dan Exit Survey — tarikh & deadline apa?",
  "MDS dan Edu 5.0@UiTM tarikh apa?",
  "Pendaftaran sepenuh masa (online & fizikal) tarikh apa?",
  "Pendaftaran ePJJ/PLK dan validasi kursus — tarikh apa?",
  "Bayar yuran last day dan penangguhan yuran — deadline apa?",
  "Pendaftaran kolej penginapan pelajar baharu bila?",
  "Persetujuan tawaran UiTM online bila?",
  "Bila tarikh akhir upload gambar kad pelajar iStudent?",
  "Gugur Taraf (GT) dan Gugur Taraf Muktamad — tarikh apa?",
];

/** General UiTM calendar questions — mixed into carousel for Group A and Group B. */
export const SUGGESTIONS_GENERAL = [
  "Boleh list minggu kuliah 1 sampai 14?",
  "Sekarang minggu kuliah ke berapa?",
  "Cuti ke peperiksaan lepas ni tarikh apa?",
  "Cuti umum negeri saya tahun ni ada apa je?",
  "Cuti umum Malaysia bulan depan ada apa?",
  "Beza cuti pertengahan semester dengan cuti umum apa?",
  "Minggu Ulangkaji dengan Peperiksaan Akhir tu maksudnya apa?",
  "Tolong rancang pelan belajar untuk semester ini",
  "Penangguhan yuran (Fee Deferment) deadline apa dalam kalendar?",
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
