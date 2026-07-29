const DISCORD_CONTENT_MAX_LENGTH = 2000;
const DISCORD_EMBED_TITLE_MAX_LENGTH = 256;
const DISCORD_EMBED_DESCRIPTION_MAX_LENGTH = 4096;
const DISCORD_EMBED_FIELD_NAME_MAX_LENGTH = 256;
const DISCORD_EMBED_FIELD_VALUE_MAX_LENGTH = 1024;
const DISCORD_EMBED_MAX_COUNT = 10;

export type DiscordWebhookKind = "chat_helpful" | "chat_not_helpful";

const WEBHOOK_ENV_KEYS: Record<DiscordWebhookKind, string> = {
  chat_helpful: "DISCORD_WEBHOOK_CHAT_HELPFUL",
  chat_not_helpful: "DISCORD_WEBHOOK_CHAT_NOT_HELPFUL",
};

const _discordWebhookUrls: Partial<Record<DiscordWebhookKind, string>> = {};

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  fields?: DiscordEmbedField[];
}

export function getDiscordWebhookUrl(kind: DiscordWebhookKind): string {
  const cached = _discordWebhookUrls[kind];
  if (cached) return cached;
  const envKey = WEBHOOK_ENV_KEYS[kind];
  const url = process.env[envKey]?.trim();
  if (!url) {
    const devHint =
      process.env.NODE_ENV !== "production"
        ? ` Set ${envKey} in .env.local and restart \`pnpm dev\`.`
        : "";
    throw new Error(`Discord env validation failed: ${envKey} is required.${devHint}`);
  }
  _discordWebhookUrls[kind] = url;
  return url;
}

export function chatFeedbackWebhookKind(rating: "up" | "down"): DiscordWebhookKind {
  return rating === "up" ? "chat_helpful" : "chat_not_helpful";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3) + "...";
}

function truncateContent(content: string): string {
  return truncate(content, DISCORD_CONTENT_MAX_LENGTH);
}

function normalizeEmbed(embed: DiscordEmbed): DiscordEmbed {
  return {
    ...embed,
    title: embed.title ? truncate(embed.title, DISCORD_EMBED_TITLE_MAX_LENGTH) : undefined,
    description: embed.description
      ? truncate(embed.description, DISCORD_EMBED_DESCRIPTION_MAX_LENGTH)
      : undefined,
    fields: embed.fields?.map((field) => ({
      ...field,
      name: truncate(field.name, DISCORD_EMBED_FIELD_NAME_MAX_LENGTH),
      value: truncate(field.value, DISCORD_EMBED_FIELD_VALUE_MAX_LENGTH),
    })),
  };
}

function normalizeEmbeds(embeds: DiscordEmbed[]): DiscordEmbed[] {
  return embeds.slice(0, DISCORD_EMBED_MAX_COUNT).map(normalizeEmbed);
}

async function assertDiscordResponseOk(response: Response): Promise<void> {
  if (response.ok) return;
  const detail = await response.text().catch(() => "");
  throw new Error(`Discord webhook failed (${response.status}): ${detail.slice(0, 200)}`);
}

export async function sendDiscordWebhook(params: {
  kind: DiscordWebhookKind;
  content?: string;
  embeds: DiscordEmbed[];
}): Promise<void> {
  const url = getDiscordWebhookUrl(params.kind);
  const payload: { content?: string; embeds: DiscordEmbed[] } = {
    embeds: normalizeEmbeds(params.embeds),
  };
  if (params.content?.trim()) {
    payload.content = truncateContent(params.content.trim());
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await assertDiscordResponseOk(response);
}

export function buildContactNotificationEmbed(params: {
  who: string;
  category: string;
  message: string;
  rating: number;
  email?: string;
  time: string;
}): DiscordEmbed {
  const trimmedEmail = params.email?.trim() ?? "";
  const fields: DiscordEmbedField[] = [
    { name: "Who", value: params.who, inline: true },
    { name: "Category", value: params.category, inline: true },
    { name: "Rating", value: `${params.rating} out of 5 stars`, inline: true },
    { name: "Time", value: params.time, inline: false },
  ];
  if (trimmedEmail.length > 0) {
    fields.push({ name: "Email", value: trimmedEmail, inline: false });
  }

  return {
    title: "User Feedback",
    color: 0x5865f2,
    fields,
    description: params.message,
  };
}

const ENGAGEMENT_REASON_MAX_CHARS = 1024;

function excerptEngagementReason(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "(empty)";
  if (trimmed.length <= ENGAGEMENT_REASON_MAX_CHARS) return trimmed;
  return trimmed.slice(0, ENGAGEMENT_REASON_MAX_CHARS - 3) + "...";
}

export function buildEngagementNotificationEmbed(params: {
  rating: number;
  time: string;
  reason?: string;
}): DiscordEmbed {
  const fields: DiscordEmbed["fields"] = [
    { name: "Rating", value: `${params.rating} out of 5 stars`, inline: true },
    { name: "Time", value: params.time, inline: true },
  ];
  const reason = params.reason?.trim();
  if (reason) {
    fields.push({ name: "Reason", value: excerptEngagementReason(reason), inline: false });
  }
  return {
    title: "User Star Rating",
    color: 0xfee75c,
    fields,
  };
}

const CHAT_FEEDBACK_EXCERPT_CHARS = 800;

function excerptForDiscord(text: string, max = CHAT_FEEDBACK_EXCERPT_CHARS): string {
  const t = text.trim();
  if (!t) return "(empty)";
  if (t.length <= max) return t;
  return t.slice(0, max - 3) + "...";
}

/** Simple embed for chat thumbs (no ISO timestamp field). */
export function buildChatFeedbackEmbed(params: {
  rating: "up" | "down";
  userMessage: string;
  assistantMessage: string;
  time: string;
  program?: string;
  correlationId?: string;
}): DiscordEmbed {
  const isUp = params.rating === "up";
  const program = params.program?.trim() || "—";
  const ref = params.correlationId?.trim() || "—";

  return {
    title: isUp ? "Chat AI — helpful" : "Chat AI — not helpful",
    color: isUp ? 0x57f287 : 0xed4245,
    fields: [
      { name: "Rating", value: isUp ? "Thumbs up" : "Thumbs down", inline: true },
      { name: "Time", value: params.time, inline: true },
      { name: "Program", value: program, inline: true },
      { name: "Ref", value: ref, inline: true },
      { name: "Question", value: excerptForDiscord(params.userMessage), inline: false },
      { name: "Answer", value: excerptForDiscord(params.assistantMessage), inline: false },
    ],
  };
}
