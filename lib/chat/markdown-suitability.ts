/** Unwrap server-side [TABLE]...[/TABLE] blocks into plain GFM pipe tables. */
export function contentToMarkdown(content: string): string {
  return content.replace(/\[TABLE\]([\s\S]*?)\[\/TABLE\]/gi, (_, body) =>
    String(body).trim()
  );
}
