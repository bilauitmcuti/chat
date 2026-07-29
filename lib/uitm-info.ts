/**
 * Static knowledge base sourced from https://www.uitm.edu.my/
 * Used as AI context for general UiTM questions that go beyond calendar data.
 * Data stored in uitm-info.json for AI model access in research-mode chat.
 * Last updated: February 2026
 */

import uitmInfoData from "./uitm-info.json";

interface ProgrammeLevel {
  name: string;
  duration?: string;
  note?: string;
  details?: string;
}

interface UitmInfoJson {
  about: Record<string, string | string[]>;
  history: Array<{ year?: number | string; event?: string; note?: string }>;
  campuses: Record<string, unknown> & { byState?: Record<string, string>; kktNote?: string };
  faculties: Record<string, string[]>;
  programmes: { levels: ProgrammeLevel[] };
  admission: Record<string, string | string[]>;
  examGrades?: {
    passing: { grades: string[]; status: string };
    failing: { grades: string[]; status: string };
  };
  studentFees?: {
    title: string;
    tuition: {
      semester1: { diploma: string; degree: string };
      semester2AndAbove: { diploma: string; degree: string };
    };
    collegePerSemester: {
      double: string;
      triple: string;
      quad: string;
      labels?: { double: string; triple: string; quad: string };
    };
    electricalPerItemPerSemester: string;
    electricalNote?: string;
    disclaimer: string;
  };
  portals: Record<string, string>;
  contact: Record<string, string>;
  links: Record<string, string>;
}

const data = uitmInfoData as unknown as UitmInfoJson;

/**
 * Flatten structured JSON to string format for AI system prompts.
 * Produces the same format as the original UITM_GENERAL_INFO for compatibility.
 */
export function getUitmInfoAsContext(): string {
  const lines: string[] = [];

  lines.push("=== ABOUT UiTM (Source: uitm.edu.my) ===");
  lines.push(
    `${data.about.name} is ${data.about.description}, serving ${data.about.students} with ${data.about.programmes}.`
  );
  lines.push("");
  lines.push(`Vision: ${data.about.vision}`);
  lines.push(`Mission: ${data.about.mission}`);
  lines.push(`Motto: ${data.about.motto}`);
  lines.push(`Tagline: ${data.about.tagline}`);
  lines.push(`Core Values: ${(data.about.coreValues as string[]).join(", ")}`);
  lines.push("");
  lines.push(`Vice-Chancellor: ${data.about.viceChancellor}`);
  lines.push("");

  lines.push("=== HISTORY ===");
  for (const h of data.history) {
    if ("note" in h && h.note) {
      lines.push(`- ${h.note}`);
    } else if ("year" in h && "event" in h) {
      lines.push(`- ${h.year}: ${h.event}`);
    }
  }
  lines.push("");

  lines.push("=== CAMPUSES (35 campuses across all 13 states) ===");
  lines.push(`Main Campus: ${data.campuses.main}`);
  lines.push(`Network: ${data.campuses.network}`);
  lines.push("");
  lines.push("By State:");
  if (data.campuses.byState) {
    for (const [state, info] of Object.entries(data.campuses.byState)) {
      lines.push(`- ${state}: ${info}`);
    }
  }
  if (data.campuses.kktNote) {
    lines.push("");
    lines.push(`Note: ${data.campuses.kktNote}`);
  }
  lines.push("");

  lines.push("=== 24 FACULTIES & ACADEMIC CENTRES ===");
  const facultyLabels: Record<string, string> = {
    engineering: "Engineering:",
    businessManagement: "Business & Management:",
    computingScience: "Computing & Science:",
    creativeMedia: "Creative & Media:",
    healthMedicine: "Health & Medicine:",
    specialized: "Specialized Fields:",
    academicCentres: "Academic Centres:",
  };
  for (const [key, label] of Object.entries(facultyLabels)) {
    const items = data.faculties[key];
    if (items) {
      lines.push(label);
      items.forEach((f) => lines.push(`- ${f}`));
    }
  }
  lines.push("");

  lines.push("=== PROGRAMME LEVELS ===");
  for (const p of data.programmes.levels) {
    let line = `- ${p.name}`;
    if (p.duration) line += ` (${p.duration})`;
    if (p.note) line += ` — Note: ${p.note}`;
    if (p.details) line += ` - ${p.details}`;
    lines.push(line);
  }
  lines.push("");

  lines.push("=== ADMISSION & APPLICATION ===");
  lines.push("Application channels:");
  (data.admission.channels as string[]).forEach((c) => lines.push(`- ${c}`));
  lines.push("");
  lines.push(`Entry qualifications accepted: ${data.admission.entryQualifications}`);
  lines.push(data.admission.note as string);
  lines.push("");

  if (data.examGrades) {
    lines.push("=== GRADING (PEPERIKSAAN) ===");
    lines.push(
      `Lulus (LU): ${data.examGrades.passing.grades.join(", ")} — ${data.examGrades.passing.status}`
    );
    lines.push(
      `Gagal (GA): ${data.examGrades.failing.grades.join(", ")} — ${data.examGrades.failing.status}`
    );
    lines.push("");
  }

  if (data.studentFees) {
    const fees = data.studentFees;
    lines.push(`=== YURAN PENGAJIAN (ANGGARAN) — ${fees.title} ===`);
    lines.push("Yuran Pengajian (Semester 1 / first sem):");
    lines.push(`- Diploma: ${fees.tuition.semester1.diploma}`);
    lines.push(`- Degree: ${fees.tuition.semester1.degree}`);
    lines.push("Yuran Pengajian (Semester 2 dan ke atas):");
    lines.push(`- Diploma: ${fees.tuition.semester2AndAbove.diploma}`);
    lines.push(`- Degree: ${fees.tuition.semester2AndAbove.degree}`);
    lines.push("Yuran Kolej (satu semester):");
    const roomLabels = fees.collegePerSemester.labels;
    lines.push(
      `- ${roomLabels?.double ?? "Bilik Berdua"}: ${fees.collegePerSemester.double}`
    );
    lines.push(
      `- ${roomLabels?.triple ?? "Bilik Bertiga"}: ${fees.collegePerSemester.triple}`
    );
    lines.push(
      `- ${roomLabels?.quad ?? "Bilik Berempat"}: ${fees.collegePerSemester.quad}`
    );
    lines.push(
      `${fees.electricalNote ?? "Yuran Barang Elektrik (satu semester)"}: ${fees.electricalPerItemPerSemester} per barang`
    );
    lines.push(`Disclaimer: ${fees.disclaimer}`);
    lines.push("");
  }

  lines.push("=== STUDENT PORTALS & SERVICES ===");
  lines.push(`- Official Website: ${data.portals.officialWebsite}`);
  lines.push(`- iStudent Portal: ${data.portals.iStudentPortal}`);
  lines.push(`- UiTMone Card: ${data.portals.uitmoneCard}`);
  lines.push(`- SuFO: ${data.portals.sufo}`);
  lines.push(`- MDS: ${data.portals.mds}`);
  lines.push("");

  lines.push("=== CONTACT ===");
  lines.push(`Address: ${data.contact.address}`);
  lines.push(`Phone: ${data.contact.phone}`);
  lines.push(`Hours: ${data.contact.hours}`);
  lines.push(`Website: ${data.contact.website}`);
  lines.push(`Contact page: ${data.contact.contactPage}`);
  lines.push("");

  lines.push("=== USEFUL LINKS ===");
  const linkLabels: Record<string, string> = {
    official: "Official website",
    academicAffairs: "Academic affairs",
    programmeSearch: "Programme search",
    applicationPortal: "Application portal",
    iStudentPortal: "iStudent portal",
    uitmFacts: "UiTM Facts",
  };
  for (const [key, url] of Object.entries(data.links)) {
    const label = linkLabels[key] ?? key;
    lines.push(`- ${label}: ${url}`);
  }

  return lines.join("\n").trim();
}

/** Flattened string for AI prompts. Same format as original for compatibility. */
export const UITM_GENERAL_INFO = getUitmInfoAsContext();
