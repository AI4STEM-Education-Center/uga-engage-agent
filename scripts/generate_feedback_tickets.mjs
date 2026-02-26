#!/usr/bin/env node

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const TSV_PATH = path.resolve(
  process.cwd(),
  "internal_feedback/priority_table.tsv",
);
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "internal_feedback/dev_tickets.json",
);
// Fixed model for this offline ticket-generation job.
const MODEL = "gpt-5.2";

function parseTsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }

  const [headerLine, ...rowLines] = lines;
  const headers = headerLine.split("\t");

  const idxFeedbackNumber = headers.indexOf("feedback_number");
  const idxUserFeedback = headers.indexOf("user_feedback");
  const idxChenyu = headers.indexOf("chenyu_and_related");

  if (idxFeedbackNumber === -1 || idxUserFeedback === -1 || idxChenyu === -1) {
    throw new Error(
      "TSV header must include feedback_number, user_feedback, and chenyu_and_related columns.",
    );
  }

  return rowLines
    .map((line) => line.split("\t"))
    .map((cols) => ({
      feedbackNumber: cols[idxFeedbackNumber],
      userFeedback: cols[idxUserFeedback],
      chenyu: cols[idxChenyu],
    }))
    .filter(
      (row) =>
        row.feedbackNumber &&
        row.userFeedback &&
        String(row.userFeedback).trim().length > 0,
    );
}

const SYSTEM_PROMPT = `
You are a senior product manager and tech lead helping convert qualitative feedback into concrete development tickets for the Engage Agent application.

You will receive:
- A feedback_number (e.g., "1")
- The raw "# User feedback" text
- The "Chenyu and related notes" text that interprets or elaborates on the feedback

Your task:
- Identify **concrete, actionable development work** that should be done by engineers and designers.
- Group related work into tickets with clear scope.
- Each ticket should be implementable within a few days by a small dev/design team.

Output format:
- Always return a **JSON object** with this exact schema:
{
  "tickets": [
    {
      "title": string,
      "description": string,
      "reference": string
    }
  ]
}

Field rules:
- "title": A short, imperative summary of the work (e.g., "Add regenerate button for media content").
- "description": 2–6 sentences that clearly describe:
  - the problem or need,
  - the proposed behavior or change,
  - any relevant UX or technical considerations.
- "reference": Always use the pattern "#<feedback_number> User feedback" (for example, "#1 User feedback").

Important behavior:
- If the feedback does **not** imply clear product or engineering work, return {"tickets": []}.
- If there are **multiple distinct** pieces of work, create multiple tickets.
- Do **not** include research-only items unless they clearly drive a product or engineering change.
- Focus tickets on what should change in the Engage Agent product (UI, UX, features, reliability), not general research questions.
`.trim();

async function generateTicketsForRow(client, row) {
  const feedbackNumber = String(row.feedbackNumber).trim();
  const userPrompt = `
Feedback number: ${feedbackNumber}

# User feedback
${row.userFeedback}

# Chenyu and related notes
${row.chenyu}

From this feedback, extract concrete, actionable development tickets for the Engage Agent product.
Remember:
- Return a JSON object with a "tickets" array.
- Use "reference": "#${feedbackNumber} User feedback" for every ticket from this feedback.
- If nothing is actionable, return {"tickets": []}.
`.trim();

  const response = await client.responses.create({
    model: MODEL,
    text: { format: { type: "json_object" } },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: SYSTEM_PROMPT,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: userPrompt,
          },
        ],
      },
    ],
  });

  const content = response.output_text ?? "{}";

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.warn(
      `Failed to parse JSON for feedback #${feedbackNumber}, got:`,
      content,
    );
    return [];
  }

  if (!parsed || !Array.isArray(parsed.tickets)) {
    return [];
  }

  return parsed.tickets.map((ticket, index) => ({
    feedback_number: Number(feedbackNumber),
    title:
      (ticket.title && String(ticket.title).trim()) ||
      `TODO from feedback #${feedbackNumber} (${index + 1})`,
    description:
      (ticket.description && String(ticket.description).trim()) || "",
    reference:
      (ticket.reference && String(ticket.reference).trim()) ||
      `#${feedbackNumber} User feedback`,
  }));
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let tsvText;
  try {
    tsvText = await fs.readFile(TSV_PATH, "utf8");
  } catch (err) {
    console.error(
      `Failed to read TSV file at ${path.relative(process.cwd(), TSV_PATH)}:`,
      err,
    );
    process.exit(1);
  }

  let rows;
  try {
    rows = parseTsv(tsvText);
  } catch (err) {
    console.error("Failed to parse TSV file:", err);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log("No feedback rows found in TSV; nothing to do.");
    return;
  }

  console.log(`Loaded ${rows.length} feedback rows from TSV.`);

  // Load existing tickets if the JSON file is present.
  let existing = { tickets: [] };
  try {
    const existingRaw = await fs.readFile(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(existingRaw);
    if (parsed && Array.isArray(parsed.tickets)) {
      existing = parsed;
    }
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      console.warn(
        `Could not read existing JSON at ${path.relative(process.cwd(), OUTPUT_PATH)}; starting fresh.`,
      );
    }
  }

  const allTickets = Array.isArray(existing.tickets)
    ? [...existing.tickets]
    : [];

  // Process rows with limited parallelism. This script is mostly I/O bound
  // (LLM calls), so a small concurrency factor significantly speeds it up
  // without overwhelming the API.
  const CONCURRENCY =
    Number.parseInt(process.env.FEEDBACK_TICKET_CONCURRENCY ?? "", 10) || 6;

  console.log(`Processing feedback rows with concurrency = ${CONCURRENCY}...`);

  let index = 0;
  let writeChain = Promise.resolve();

  function enqueueWrite(newTickets) {
    if (!newTickets || newTickets.length === 0) {
      return writeChain;
    }
    writeChain = writeChain.then(async () => {
      allTickets.push(...newTickets);
      const output = { tickets: allTickets };
      await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
    });
    return writeChain;
  }

  async function worker(workerId) {
    while (index < rows.length) {
      const currentIndex = index++;
      const row = rows[currentIndex];
      const feedbackNumber = String(row.feedbackNumber).trim();
      console.log(
        `Worker ${workerId}: processing feedback #${feedbackNumber} (row ${currentIndex + 1}/${rows.length})...`,
      );
      try {
        const tickets = await generateTicketsForRow(client, row);
        if (tickets.length === 0) {
          console.log(
            `  Worker ${workerId}: no tickets generated for #${feedbackNumber}.`,
          );
          continue;
        }
        console.log(
          `  Worker ${workerId}: generated ${tickets.length} ticket(s) for #${feedbackNumber}.`,
        );
        await enqueueWrite(tickets);
      } catch (err) {
        console.error(
          `  Worker ${workerId}: error generating tickets for #${feedbackNumber}:`,
          err,
        );
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, rows.length);
  await Promise.all(
    Array.from({ length: workerCount }, (_, i) => worker(i + 1)),
  );

  try {
    await writeChain;
  } catch (err) {
    console.error(
      `Failed to write JSON file at ${path.relative(process.cwd(), OUTPUT_PATH)}:`,
      err,
    );
    process.exit(1);
  }

  console.log(
    `Wrote ${allTickets.length} tickets to ${path.relative(process.cwd(), OUTPUT_PATH)}.`,
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
