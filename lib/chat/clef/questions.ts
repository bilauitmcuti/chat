import type { ChatMessage } from "@/lib/ai";
import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import type { ChatTopic } from "@/lib/chat/topic-router";
import { CLEF_MODEL_SELECTOR } from "@/lib/chat/clef/model";

export interface ClefQuestion {
  type: "noul" | "choice";
  instructions: string;
  criteria?: Record<string, string>;
}

export function buildClefQuestions(): Record<string, ClefQuestion> {
  return {
    primary_topic: {
      type: "choice",
      instructions: "What is the primary topic of this UiTM student question?",
      criteria: {
        academic_calendar:
          "UiTM academic calendar dates: exams, registration, semester breaks, fee deadlines",
        lecture_weeks: "Lecture week numbers or which teaching week it is now",
        public_holiday:
          "Malaysia or state public holidays (cuti umum, cuti awam, cuti negeri)",
        uitm_general: "General UiTM campus, admissions, or non-calendar knowledge",
      },
    },
    also_lecture_weeks: {
      type: "noul",
      instructions: "Does the question also ask about lecture weeks?",
    },
    also_public_holiday: {
      type: "noul",
      instructions:
        "Does the question also ask about Malaysia or state public holidays?",
    },
    also_uitm_general: {
      type: "noul",
      instructions:
        "Does the question also ask general UiTM info that is not a calendar date?",
    },
    calendar_intent: {
      type: "choice",
      instructions:
        "Which academic-calendar intent best matches, even if the primary topic is not the calendar?",
      criteria: {
        all: "Broad or unclear calendar ask",
        break: "Semester or mid-semester break (cuti semester), not a public holiday",
        exam: "Examinations",
        lecture: "Lecture or teaching period",
        registration: "Registration or add-drop",
        fee: "Academic fee or GT payment deadlines",
        revision: "Revision or study week",
        gugur: "Gugur taraf or deregistration",
        days_until: "How many days until an event",
        lecture_count: "How many lecture weeks",
        festive: "Festive recess or public-holiday period",
      },
    },
    is_day_status: {
      type: "noul",
      instructions:
        "Is the user asking whether there is class today, tomorrow, or on a specific day?",
    },
    reply_language: {
      type: "choice",
      instructions: "Which language should the chatbot reply in?",
      criteria: {
        en: "English, including English with Malay loanwords like cuti or semester",
        ms: "Malaysian Malay",
        mixed: "Natural Malay-English blend",
      },
    },
  };
}

export function buildClefState(input: {
  message: string;
  history?: ChatMessage[];
  heuristicTopics: ChatTopic[];
  heuristicIntent: CalendarContextIntent;
  hasMatchedActivity: boolean;
}): Record<string, unknown> {
  const recent = (input.history ?? [])
    .slice(-4)
    .map((turn) => `${turn.role}: ${turn.content.slice(0, 180)}`)
    .join("\n");

  return {
    chatbot: "UiTM student academic calendar assistant",
    user_message: input.message,
    recent_turns: recent || "(none)",
    heuristic_topics: input.heuristicTopics,
    heuristic_intent: input.heuristicIntent,
    has_matched_activity: input.hasMatchedActivity,
  };
}

export function buildClefRunInput(state: Record<string, unknown>): Record<string, unknown> {
  return {
    model: CLEF_MODEL_SELECTOR,
    state,
    questions: buildClefQuestions(),
  };
}
