import uitmInfoData from "@/lib/uitm-info.json";
import { truncateToolOutput } from "@/lib/chat/agent/types";

interface SearchSection {
  id: string;
  title: string;
  body: string;
}

function tokenize(text: string): string[] {
  const normalized = text
    .toLowerCase()
    // Common typo seen in user queries.
    .replace(/\bcollage\b/g, "college");

  const tokenAliases: Record<string, string> = {
    yuran: "fee",
    fees: "fee",
    tuition: "fee",
    hostel: "college",
  };

  return normalized
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .flatMap((w) => {
      if (w.length <= 2) return [];
      const alias = tokenAliases[w];
      return alias ? [w, alias] : [w];
    });
}

function buildSections(): SearchSection[] {
  const data = uitmInfoData as Record<string, unknown>;
  const sections: SearchSection[] = [];

  const push = (id: string, title: string, body: string) => {
    const trimmed = body.trim();
    if (trimmed) sections.push({ id, title, body: trimmed });
  };

  const about = data.about as Record<string, unknown> | undefined;
  if (about) {
    push(
      "about",
      "About UiTM",
      [
        String(about.name ?? ""),
        String(about.description ?? ""),
        `Vision: ${about.vision ?? ""}`,
        `Mission: ${about.mission ?? ""}`,
        `Students: ${about.students ?? ""}`,
        `Programmes: ${about.programmes ?? ""}`,
      ].join("\n")
    );
  }

  const history = data.history as Array<{ year?: number | string; event?: string; note?: string }> | undefined;
  if (history?.length) {
    push(
      "history",
      "History",
      history
        .map((h) => (h.note ? `- ${h.note}` : h.year && h.event ? `- ${h.year}: ${h.event}` : ""))
        .filter(Boolean)
        .join("\n")
    );
  }

  const campuses = data.campuses as Record<string, unknown> | undefined;
  if (campuses) {
    const lines = [
      `Main: ${campuses.main ?? ""}`,
      `Network: ${campuses.network ?? ""}`,
    ];
    const byState = campuses.byState as Record<string, string> | undefined;
    if (byState) {
      for (const [state, info] of Object.entries(byState)) {
        lines.push(`- ${state}: ${info}`);
      }
    }
    push("campuses", "Campuses", lines.join("\n"));
  }

  const faculties = data.faculties as Record<string, string[]> | undefined;
  if (faculties) {
    const lines: string[] = [];
    for (const [key, items] of Object.entries(faculties)) {
      if (!Array.isArray(items)) continue;
      lines.push(`${key}:`);
      items.forEach((f) => lines.push(`- ${f}`));
    }
    push("faculties", "Faculties", lines.join("\n"));
  }

  const programmes = data.programmes as { levels?: Array<{ name: string; duration?: string; note?: string; details?: string }> } | undefined;
  if (programmes?.levels?.length) {
    push(
      "programmes",
      "Programmes",
      programmes.levels
        .map((p) => {
          let line = `- ${p.name}`;
          if (p.duration) line += ` (${p.duration})`;
          if (p.note) line += ` — ${p.note}`;
          if (p.details) line += ` — ${p.details}`;
          return line;
        })
        .join("\n")
    );
  }

  const admission = data.admission as Record<string, unknown> | undefined;
  if (admission) {
    const channels = admission.channels as string[] | undefined;
    push(
      "admission",
      "Admission",
      [
        channels?.length ? `Channels:\n${channels.map((c) => `- ${c}`).join("\n")}` : "",
        admission.note ? String(admission.note) : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const examGrades = data.examGrades as
    | {
        passing?: { grades?: string[]; status?: string };
        failing?: { grades?: string[]; status?: string };
      }
    | undefined;
  if (examGrades) {
    const passing = examGrades.passing;
    const failing = examGrades.failing;
    push(
      "exam-grades",
      "Exam Grades",
      [
        passing?.grades?.length
          ? `Passing (${passing.status ?? "LU"}): ${passing.grades.join(", ")}`
          : "",
        failing?.grades?.length
          ? `Failing (${failing.status ?? "GA"}): ${failing.grades.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const studentFees = data.studentFees as
    | {
        title?: string;
        tuition?: {
          semester1?: { diploma?: string; degree?: string };
          semester2AndAbove?: { diploma?: string; degree?: string };
        };
        collegePerSemester?: {
          double?: string;
          triple?: string;
          quad?: string;
          labels?: { double?: string; triple?: string; quad?: string };
        };
        electricalPerItemPerSemester?: string;
        electricalNote?: string;
        disclaimer?: string;
      }
    | undefined;
  if (studentFees) {
    push(
      "student-fees",
      "Student Fees",
      [
        studentFees.title ? `Title: ${studentFees.title}` : "",
        studentFees.tuition?.semester1
          ? `Semester 1 tuition — Diploma: ${studentFees.tuition.semester1.diploma ?? "-"}, Degree: ${studentFees.tuition.semester1.degree ?? "-"}`
          : "",
        studentFees.tuition?.semester2AndAbove
          ? `Semester 2+ tuition — Diploma: ${studentFees.tuition.semester2AndAbove.diploma ?? "-"}, Degree: ${studentFees.tuition.semester2AndAbove.degree ?? "-"}`
          : "",
        studentFees.collegePerSemester
          ? [
              "College per semester:",
              `- ${studentFees.collegePerSemester.labels?.double ?? "Bilik Berdua"}: ${studentFees.collegePerSemester.double ?? "-"}`,
              `- ${studentFees.collegePerSemester.labels?.triple ?? "Bilik Bertiga"}: ${studentFees.collegePerSemester.triple ?? "-"}`,
              `- ${studentFees.collegePerSemester.labels?.quad ?? "Bilik Berempat"}: ${studentFees.collegePerSemester.quad ?? "-"}`,
            ].join("\n")
          : "",
        studentFees.electricalPerItemPerSemester
          ? `${studentFees.electricalNote ?? "Electrical item fee per semester"}: ${studentFees.electricalPerItemPerSemester}`
          : "",
        studentFees.disclaimer ? `Disclaimer: ${studentFees.disclaimer}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const contact = data.contact as Record<string, string> | undefined;
  if (contact) {
    push("contact", "Contact", Object.entries(contact).map(([k, v]) => `${k}: ${v}`).join("\n"));
  }

  const portals = data.portals as Record<string, string> | undefined;
  if (portals) {
    push("portals", "Portals", Object.entries(portals).map(([k, v]) => `${k}: ${v}`).join("\n"));
  }

  return sections;
}

const SECTIONS = buildSections();

export function searchUitmKnowledge(query: string, maxSections = 3): string {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) {
    return truncateToolOutput(
      SECTIONS.slice(0, 2)
        .map((s) => `=== ${s.title} ===\n${s.body}`)
        .join("\n\n")
    );
  }

  const scored = SECTIONS.map((section) => {
    const textTokens = tokenize(`${section.title} ${section.body}`);
    let score = 0;
    for (const t of textTokens) {
      if (qTokens.has(t)) score += 1;
    }
    return { section, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked =
    scored.length > 0 ? scored.slice(0, maxSections) : [{ section: SECTIONS[0]!, score: 0 }];

  const block = picked
    .map(({ section }) => `=== ${section.title} ===\n${section.body}`)
    .join("\n\n");

  return truncateToolOutput(block || "(no UiTM knowledge matched — say you do not have that detail)");
}
