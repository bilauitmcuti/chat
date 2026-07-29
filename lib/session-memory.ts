import { getGroupFromSession, type SessionId } from "@/lib/data";
import { isGroupASessionId } from "@/lib/group-a-sessions";
import type { ProgramValue } from "@/lib/route-utils";

export function getGroupFromProgram(program: ProgramValue): "A" | "B" {
  return program === "Foundation/Professional" ? "A" : "B";
}

export function getSessionMemoryKey(program: ProgramValue): ProgramValue {
  return getGroupFromProgram(program) === "B" ? "All" : program;
}

export function normalizeSessionsForGroup(
  sessionIds: SessionId[],
  group: "A" | "B"
): SessionId[] {
  const unique = Array.from(new Set(sessionIds));
  if (group === "A") {
    return unique.filter((id) => isGroupASessionId(id));
  }
  return unique.filter((id) => getGroupFromSession(id) === "B");
}

export function areSessionListsEqual(left: SessionId[], right: SessionId[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((id, index) => right[index] === id);
}
