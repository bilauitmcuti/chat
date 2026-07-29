import { detectUserLanguage } from "@/lib/chat-language";
import {
  clampWords,
  fillTemplate,
  hasForbiddenStatusTerms,
  isValidProgressSummary,
  langBucket,
  pickProgressPhrase,
  resolveReasoningIntent,
  resolveReasoningSource,
  resolveReasoningTopic,
  wordCount,
  type LangBucket,
  type ReasoningIntent,
  type ReasoningParagraphInput,
  type ReasoningPhase,
  type ReasoningPhaseHint,
  type ReasoningStatus,
  type ReasoningStatusInput,
  MIN_REASONING_WORDS,
} from "@/lib/chat/reasoning-status";

const PROGRESS_SUMMARY_POOLS: Record<
  ReasoningIntent,
  Record<LangBucket, readonly string[]>
> = {
  semester_start: {
    en: [
      "I'm identifying the current semester and confirming when lectures begin before giving you the exact start date from the official calendar.",
      "The current semester is being matched carefully so the lecture start date reflects the official academic calendar for your programme.",
      "Looking at the semester timeline now to confirm when classes begin and share the precise start date with you clearly.",
      "The lecture start window is being confirmed against the official calendar so your answer uses the right semester dates.",
    ],
    malay: [
      "Saya sedang mengenal pasti semester semasa dan mengesahkan bila kuliah bermula sebelum memberikan tarikh mula yang tepat daripada kalendar rasmi.",
      "Semester semasa sedang dipadankan dengan teliti supaya tarikh mula kuliah mencerminkan kalendar akademik rasmi untuk program anda.",
      "Garis masa semester sedang diteliti untuk mengesahkan bila kelas bermula dan berkongsi tarikh mula yang tepat dengan jelas.",
      "Tempoh mula kuliah sedang disahkan berdasarkan kalendar rasmi supaya jawapan anda menggunakan tarikh semester yang betul.",
    ],
  },
  short_semester: {
    en: [
      "The short semester period is being matched with the correct session so the answer reflects the right start and end dates.",
      "I'm lining up the short semester against the official session calendar before sharing the start and end dates with you.",
      "The intersession window is being confirmed carefully so the dates you receive match the published short semester schedule.",
      "Matching the short semester to the right academic session now so the start and end dates stay accurate for you.",
    ],
    malay: [
      "Tempoh semester pendek sedang dipadankan dengan sesi yang betul supaya jawapan mencerminkan tarikh mula dan tamat yang tepat.",
      "Saya sedang menyelaraskan semester pendek dengan kalendar sesi rasmi sebelum berkongsi tarikh mula dan tamat dengan anda.",
      "Tempoh intersession sedang disahkan dengan teliti supaya tarikh yang anda terima sepadan dengan jadual semester pendek diterbitkan.",
      "Semester pendek sedang dipadankan dengan sesi akademik yang betul supaya tarikh mula dan tamat kekal tepat untuk anda.",
    ],
  },
  lecture_weeks: {
    en: [
      "The lecture week schedule is being reviewed so the week and dates you need line up with the official academic calendar.",
      "I'm locating the right lecture week on the semester timeline before confirming the matching dates for you clearly.",
      "The week you asked about is being matched to the official lecture week calendar so the dates stay accurate.",
      "Arranging the lecture week details now so the answer points to the correct week and date range for you.",
    ],
    malay: [
      "Jadual minggu kuliah sedang diteliti supaya minggu dan tarikh yang anda perlukan selari dengan kalendar akademik rasmi.",
      "Saya sedang mencari minggu kuliah yang betul pada garis masa semester sebelum mengesahkan tarikh yang sepadan dengan jelas.",
      "Minggu yang ditanya sedang dipadankan dengan kalendar minggu kuliah rasmi supaya tarikh yang dikongsi kekal tepat.",
      "Butiran minggu kuliah sedang disusun supaya jawapan menunjuk kepada minggu dan julat tarikh yang betul untuk anda.",
    ],
  },
  lecture_week_list: {
    en: [
      "The semester timeline is being arranged into Week 1 to Week 14 so the dates are easier to read and follow.",
      "I'm organising the full lecture week list from Week 1 through Week 14 against the official academic calendar.",
      "The complete week-by-week schedule is being lined up so you can see each lecture week date clearly listed.",
      "Building the Week 1 to Week 14 overview now so the semester dates are presented in a clear readable order.",
    ],
    malay: [
      "Garis masa semester sedang disusun kepada Minggu 1 hingga Minggu 14 supaya tarikh lebih mudah dibaca dan diikuti.",
      "Saya sedang menyusun senarai penuh minggu kuliah dari Minggu 1 hingga Minggu 14 berdasarkan kalendar akademik rasmi.",
      "Jadual minggu demi minggu yang lengkap sedang diselaraskan supaya setiap tarikh minggu kuliah dapat dilihat dengan jelas.",
      "Gambaran Minggu 1 hingga Minggu 14 sedang dibina supaya tarikh semester dipaparkan dalam susunan yang jelas dan kemas.",
    ],
  },
  semester_break: {
    en: [
      "The semester break period is being confirmed against the official calendar so the start and end dates are accurate.",
      "I'm matching the break window to the right semester before sharing the official recess dates with you clearly.",
      "The mid-semester or semester break dates are being verified so your answer reflects the published academic schedule.",
      "Locating the correct break period now so the dates you receive match the official academic calendar exactly.",
    ],
    malay: [
      "Tempoh cuti semester sedang disahkan berdasarkan kalendar rasmi supaya tarikh mula dan tamat adalah tepat untuk anda.",
      "Saya sedang memadankan tempoh cuti dengan semester yang betul sebelum berkongsi tarikh rehat rasmi dengan jelas.",
      "Tarikh cuti pertengahan atau cuti semester sedang disahkan supaya jawapan mencerminkan jadual akademik yang diterbitkan.",
      "Tempoh cuti yang betul sedang dicari supaya tarikh yang anda terima sepadan dengan kalendar akademik rasmi sepenuhnya.",
    ],
  },
  exam_dates: {
    en: [
      "The examination period is being confirmed on the official calendar so the exam dates in your answer are accurate.",
      "I'm matching the exam window to the correct semester before sharing the published examination dates with you.",
      "The exam schedule is being reviewed carefully so the dates you receive reflect the official academic calendar.",
      "Locating the right examination period now so your answer stays aligned with the published exam dates clearly.",
    ],
    malay: [
      "Tempoh peperiksaan sedang disahkan pada kalendar rasmi supaya tarikh peperiksaan dalam jawapan anda adalah tepat.",
      "Saya sedang memadankan tempoh peperiksaan dengan semester yang betul sebelum berkongsi tarikh peperiksaan yang diterbitkan.",
      "Jadual peperiksaan sedang diteliti dengan teliti supaya tarikh yang anda terima mencerminkan kalendar akademik rasmi.",
      "Tempoh peperiksaan yang betul sedang dicari supaya jawapan anda selari dengan tarikh peperiksaan diterbitkan dengan jelas.",
    ],
  },
  public_holiday: {
    en: [
      "The public holiday dates that apply are being confirmed so the answer matches the official holiday calendar closely.",
      "I'm reviewing the relevant public holidays now to make sure the dates shared are accurate and up to date.",
      "The holiday schedule is being matched to your question so only the relevant public holiday dates are included.",
      "Confirming the official public holiday dates that matter for your question before preparing a clear helpful answer.",
    ],
    malay: [
      "Tarikh cuti umum yang berkenaan sedang disahkan supaya jawapan sepadan dengan kalendar cuti rasmi dengan tepat.",
      "Saya sedang meneliti cuti umum yang relevan supaya tarikh yang dikongsi adalah tepat dan kekal terkini untuk anda.",
      "Jadual cuti sedang dipadankan dengan soalan anda supaya hanya tarikh cuti umum yang relevan disertakan dalam jawapan.",
      "Tarikh cuti umum rasmi yang penting untuk soalan anda sedang disahkan sebelum jawapan yang jelas disediakan untuk anda.",
    ],
  },
  registration: {
    en: [
      "The registration window is being confirmed against the official calendar so the dates in your answer are correct.",
      "I'm matching the registration period to the right semester before sharing the official registration dates with you.",
      "The enrolment and registration dates are being verified so your answer reflects the published academic schedule.",
      "Locating the correct registration period now so the dates you receive stay accurate and relevant for you.",
    ],
    malay: [
      "Tempoh pendaftaran sedang disahkan berdasarkan kalendar rasmi supaya tarikh dalam jawapan anda adalah betul sepenuhnya.",
      "Saya sedang memadankan tempoh pendaftaran dengan semester yang betul sebelum berkongsi tarikh pendaftaran rasmi dengan anda.",
      "Tarikh pendaftaran dan enrolmen sedang disahkan supaya jawapan mencerminkan jadual akademik rasmi yang diterbitkan.",
      "Tempoh pendaftaran yang betul sedang dicari supaya tarikh yang anda terima kekal tepat dan relevan untuk soalan ini.",
    ],
  },
  student_fees: {
    en: [
      "Official UiTM student information on fees and related services is being reviewed so the answer stays accurate and clear.",
      "I'm gathering the fee and student-service details that match your question before preparing a reliable clear answer.",
      "The relevant student fee information is being confirmed so what you receive reflects official UiTM guidance closely.",
      "Looking through trusted UiTM student details now so fees and related information stay accurate for your question.",
    ],
    malay: [
      "Maklumat pelajar rasmi UiTM tentang yuran dan perkhidmatan berkaitan sedang diteliti supaya jawapan kekal tepat dan jelas.",
      "Saya sedang mengumpulkan butiran yuran dan perkhidmatan pelajar yang sepadan dengan soalan anda sebelum jawapan disediakan.",
      "Maklumat yuran pelajar yang relevan sedang disahkan supaya apa yang anda terima mencerminkan panduan rasmi UiTM dengan tepat.",
      "Butiran pelajar UiTM yang dipercayai sedang diteliti supaya yuran dan maklumat berkaitan kekal tepat untuk soalan anda.",
    ],
  },
  uitm_general: {
    en: [
      "Trusted UiTM information that fits your question is being gathered so the answer stays clear and relevant overall.",
      "I'm reviewing official UiTM details now to make sure the response matches what you asked about carefully.",
      "The UiTM information most relevant to your question is being confirmed before a clear answer is prepared for you.",
      "Looking up the official UiTM details that match your question so the answer stays accurate and easy to follow.",
    ],
    malay: [
      "Maklumat UiTM yang dipercayai dan sepadan dengan soalan anda sedang dikumpulkan supaya jawapan kekal jelas dan relevan.",
      "Saya sedang meneliti butiran rasmi UiTM supaya respons sepadan dengan apa yang anda tanya dengan teliti dan tepat.",
      "Maklumat UiTM yang paling relevan dengan soalan anda sedang disahkan sebelum jawapan yang jelas disediakan untuk anda.",
      "Butiran rasmi UiTM yang sepadan dengan soalan anda sedang dicari supaya jawapan kekal tepat dan mudah diikuti.",
    ],
  },
  matched_activity: {
    en: [
      "The calendar event you mentioned is being confirmed against the official schedule so the dates shared are accurate.",
      "I'm verifying {activity} on the academic calendar before preparing an answer with the published official dates.",
      "The official dates for {activity} are being matched to {program} so your answer reflects the published schedule.",
      "Locating {activity} on the official calendar now so the dates in your answer stay accurate and up to date.",
    ],
    malay: [
      "Acara kalendar yang anda sebut sedang disahkan berdasarkan jadual rasmi supaya tarikh yang dikongsi adalah tepat.",
      "Saya sedang mengesahkan {activity} pada kalendar akademik sebelum menyediakan jawapan dengan tarikh rasmi yang diterbitkan.",
      "Tarikh rasmi untuk {activity} sedang dipadankan dengan {program} supaya jawapan mencerminkan jadual yang diterbitkan.",
      "{activity} sedang dicari pada kalendar rasmi supaya tarikh dalam jawapan anda kekal tepat dan sentiasa terkini.",
    ],
  },
  multi_session: {
    en: [
      "The selected sessions are being compared on the official calendar so the dates line up before the answer is prepared.",
      "I'm reviewing {sessions} against the academic calendar to confirm the semester dates for each one carefully.",
      "The calendars for your selected sessions are being lined up so the comparison stays accurate and clear overall.",
      "Matching dates across {sessions} now so the answer reflects the official schedule for each selection clearly.",
    ],
    malay: [
      "Sesi terpilih sedang dibandingkan pada kalendar rasmi supaya tarikh selari sebelum jawapan disediakan dengan tepat.",
      "Saya sedang meneliti {sessions} berdasarkan kalendar akademik untuk mengesahkan tarikh semester bagi setiap satu dengan teliti.",
      "Kalendar untuk sesi pilihan anda sedang diselaraskan supaya perbandingan kekal tepat dan jelas untuk jawapan ini.",
      "Tarikh merentas {sessions} sedang dipadankan supaya jawapan mencerminkan jadual rasmi bagi setiap pilihan dengan jelas.",
    ],
  },
  general_info: {
    en: [
      "The official academic information that matches your question is being reviewed so the answer stays accurate and relevant.",
      "I'm confirming the details that fit what you asked before preparing a clear response from the official calendar.",
      "The relevant academic calendar details are being lined up so your answer reflects the right dates and context.",
      "Looking through the official information tied to your question now so the response stays on topic and accurate.",
    ],
    malay: [
      "Maklumat akademik rasmi yang sepadan dengan soalan anda sedang diteliti supaya jawapan kekal tepat dan relevan sepenuhnya.",
      "Saya sedang mengesahkan butiran yang sesuai dengan soalan anda sebelum menyediakan respons yang jelas daripada kalendar rasmi.",
      "Butiran kalendar akademik yang relevan sedang diselaraskan supaya jawapan mencerminkan tarikh dan konteks yang betul.",
      "Maklumat rasmi yang berkaitan dengan soalan anda sedang diteliti supaya respons kekal pada topik dan tepat untuk anda.",
    ],
  },
  retry: {
    en: [
      "The official details are being reviewed once more so the dates and information in your answer stay accurate overall.",
      "I'm double-checking the official information again to make sure the final answer remains precise and relevant.",
      "Another pass over the official calendar details is underway so your answer reflects the most reliable information.",
      "Confirming the key dates again now so the regenerated answer stays accurate and aligned with your question.",
    ],
    malay: [
      "Butiran rasmi sedang diteliti sekali lagi supaya tarikh dan maklumat dalam jawapan anda kekal tepat sepenuhnya.",
      "Saya sedang menyemak semula maklumat rasmi supaya jawapan akhir kekal tepat dan relevan dengan soalan anda.",
      "Semakan tambahan ke atas butiran kalendar rasmi sedang dijalankan supaya jawapan mencerminkan maklumat paling boleh dipercayai.",
      "Tarikh utama sedang disahkan sekali lagi supaya jawapan yang dijana semula kekal tepat dan selari dengan soalan anda.",
    ],
  },
};

function programPhrase(programLabel: string, lang: LangBucket): string {
  if (programLabel === "All") {
    return lang === "malay" ? "semua program" : "all programmes";
  }
  return lang === "malay" ? `program ${programLabel}` : `the ${programLabel} programme`;
}

function sessionPhrase(sessionCount: number, lang: LangBucket): string {
  if (lang === "malay") return `${sessionCount} sesi`;
  return sessionCount === 1 ? "one session" : `${sessionCount} sessions`;
}

function templateVars(input: ReasoningStatusInput, lang: LangBucket): Record<string, string> {
  const activity =
    input.activityMatches?.[0]?.activity.name?.trim() ||
    (lang === "malay" ? "acara ini" : "this event");
  return {
    program: programPhrase(input.programLabel, lang),
    activity,
    sessions: sessionPhrase(input.sessionCount, lang),
  };
}

function padToMinWords(text: string, lang: LangBucket): string {
  let result = text.replace(/\s+/g, " ").trim();
  const pad =
    lang === "malay"
      ? "Maklumat rasmi sedang disahkan supaya jawapan kekal tepat."
      : "Official details are being confirmed so the answer stays accurate.";
  while (wordCount(result) < MIN_REASONING_WORDS) {
    const withoutPeriod = result.replace(/[.!?]$/, "");
    result = `${withoutPeriod}. ${pad}`;
  }
  return clampWords(result);
}

/** Instant template fallback — used when LLM is off, slow, or invalid. */
export function buildReasoningStatusTemplate(input: ReasoningStatusInput): ReasoningStatus {
  const lang = langBucket(detectUserLanguage(input.message));
  const intent = resolveReasoningIntent(input);
  const topic = resolveReasoningTopic(intent, input);
  const source = resolveReasoningSource(intent, input.topics);
  const vars = templateVars(input, lang);
  const pool = PROGRESS_SUMMARY_POOLS[intent]?.[lang] ?? PROGRESS_SUMMARY_POOLS.general_info[lang];
  const seed = `${input.message}:${intent}:${input.phaseHint ?? "pre_answer"}:${input.toolName ?? ""}:${input.retryReason ?? ""}`;
  const template = pickProgressPhrase(pool, seed);
  let progress_summary = padToMinWords(fillTemplate(template, vars), lang);

  if (!isValidProgressSummary(progress_summary) || hasForbiddenStatusTerms(progress_summary)) {
    const fallback = padToMinWords(
      fillTemplate(PROGRESS_SUMMARY_POOLS.general_info[lang][0]!, vars),
      lang
    );
    progress_summary = isValidProgressSummary(fallback) ? fallback : progress_summary;
  }

  return { intent, topic, source, progress_summary };
}

function phaseToHint(phase: ReasoningPhase): ReasoningPhaseHint {
  if (phase === "retry") return "retry";
  if (phase === "progress") return "tool_progress";
  return "pre_answer";
}

/** Alias for callers that still use buildReasoningStatus. */
export function buildReasoningStatus(input: ReasoningStatusInput): ReasoningStatus {
  return buildReasoningStatusTemplate(input);
}

/** Thin wrapper — template progress_summary only. */
export function buildReasoningParagraph(input: ReasoningParagraphInput): string {
  return buildReasoningStatusTemplate({
    message: input.message,
    topics: input.topics,
    programLabel: input.programLabel,
    sessionCount: input.sessionCount,
    hasMatchedActivity: input.hasMatchedActivity,
    activityMatches: input.activityMatches,
    contextIntent: input.contextIntent,
    needsList: input.needsList,
    phaseHint: phaseToHint(input.phase),
    toolName: input.toolName,
    retryReason: input.retryReason,
  }).progress_summary;
}

export function buildReasoningOpener(input: {
  message: string;
  topics: ReasoningParagraphInput["topics"];
  hasMatchedActivity: boolean;
  activityMatches: NonNullable<ReasoningParagraphInput["activityMatches"]>;
  programLabel: string;
  sessionCount: number;
}): string {
  return buildReasoningParagraph({ ...input, phase: "start" });
}
