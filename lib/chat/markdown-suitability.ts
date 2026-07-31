import { stripInternalContextLeakage, promoteListSectionTitles } from "@/lib/chat/sanitize";

/**
 * Unwrap server-side [TABLE]...[/TABLE] blocks into plain GFM pipe tables.
 * Also strips unpaired [TABLE] / [/TABLE] markers so they never appear while streaming.
 */
export function contentToMarkdown(content: string): string {
  return stripInternalContextLeakage(
    promoteListSectionTitles(
      content
        .replace(/\[TABLE\]([\s\S]*?)\[\/TABLE\]/gi, (_, body) => String(body).trim())
        .replace(/\[\/?TABLE\]/gi, "")
    )
  );
}

export { promoteListSectionTitles };
