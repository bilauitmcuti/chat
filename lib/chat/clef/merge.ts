import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import {
  CLEF_INTENT_CONFIDENCE,
  CLEF_TOPIC_CONFIDENCE,
} from "@/lib/chat/clef/model";
import type { ClefUnderstanding } from "@/lib/chat/clef/parse";
import type { ChatTopic, TopicRouteResult } from "@/lib/chat/topic-router";

export interface MergedClefTurn {
  topicRoute: TopicRouteResult;
  contextIntent: CalendarContextIntent;
}

export function mergeClefUnderstanding(input: {
  heuristicRoute: TopicRouteResult;
  heuristicIntent: CalendarContextIntent;
  clef: ClefUnderstanding | null;
  hasMatchedActivity: boolean;
}): MergedClefTurn {
  const { heuristicRoute, heuristicIntent, clef, hasMatchedActivity } = input;
  if (!clef) {
    return { topicRoute: heuristicRoute, contextIntent: heuristicIntent };
  }

  const topics = new Set<ChatTopic>(heuristicRoute.topics);
  const topicConfident =
    clef.primaryTopic !== null &&
    clef.primaryTopicConfidence >= CLEF_TOPIC_CONFIDENCE;

  if (topicConfident && clef.primaryTopic) {
    topics.add(clef.primaryTopic);
    if (
      clef.primaryTopic !== "academic_calendar" &&
      !hasMatchedActivity &&
      clef.isDayStatus !== true
    ) {
      topics.delete("academic_calendar");
    }
  }

  if (clef.alsoLectureWeeks) topics.add("lecture_weeks");
  if (clef.alsoPublicHoliday) topics.add("public_holiday");
  if (clef.alsoUitmGeneral) topics.add("uitm_general");
  if (clef.isDayStatus === true) topics.add("academic_calendar");

  if (topics.size === 0) topics.add("academic_calendar");

  const contextIntent =
    clef.calendarIntent && clef.calendarIntentConfidence >= CLEF_INTENT_CONFIDENCE
      ? clef.calendarIntent
      : heuristicIntent;

  return {
    topicRoute: {
      topics: [...topics],
      hasNamedActivity: hasMatchedActivity || heuristicRoute.hasNamedActivity,
    },
    contextIntent,
  };
}

export function buildClefUnderstandingDirective(
  clef: ClefUnderstanding | null,
  topics: readonly ChatTopic[],
  intent: CalendarContextIntent
): string {
  if (!clef) return "";
  const day =
    clef.isDayStatus === true ? "yes" : clef.isDayStatus === false ? "no" : "unknown";
  const topicLabel = topics.length > 0 ? topics.join("+") : "none";
  return `\n\nUNDERSTOOD QUESTION: topics=${topicLabel}; intent=${intent}; day-status=${day}. Use this understanding when choosing calendar data. Do not answer a different topic.`;
}
