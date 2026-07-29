import fs from "fs";

const body = fs.readFileSync("components/chat/_fmt-body.txt", "utf8").replace(
  /^function FormattedMessage/m,
  "export function FormattedMessage"
);

const header = `"use client";

import type React from "react";
import {
  isMarkdownTableSeparator,
  isPipeTableRow,
  isTableCaptionRow,
  parsePipeTableBlock,
} from "@/lib/format-ai-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

`;

fs.writeFileSync("components/chat/formatted-message.tsx", header + body);
