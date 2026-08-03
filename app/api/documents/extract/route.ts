import { NextRequest, NextResponse } from "next/server";
import type OpenAI from "openai";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { completeChat, imagePart, pdfPart, GPT } from "@/lib/openai";
import { normalizeImageForOcr } from "@/lib/onboarding/ocrImage";

// Reads a document the user added in "My Documents" and stores the NON-sensitive
// facts on the document row (extracted_fields). The AI autofill agent later
// merges these across all of the user's documents to fill application fields.
//
// Handles both images (upscaled/sharpened first so low-res phone screenshots are
// readable) and PDFs (sent natively). Never extracts SSN / A-Number / passport /
// bank numbers.

export const runtime = "nodejs";

// Fields we NEVER store — even if the model returns them.
const FORBIDDEN_FIELDS = [
  "ssn", "social_security_number", "a_number", "alien_registration_number",
  "passport_number", "uscis_number", "bank_account", "routing_number", "credit_card",
];

const PROMPT = `Extract non-sensitive fields from this document so a benefits app can reuse them.

DO NOT extract: SSN, Social Security Number, A-Number, Alien Registration Number, USCIS number, passport number, bank account numbers, routing numbers, or any financial credentials.

Safe fields to extract (only if visible and clearly readable). Keep each date as YYYY-MM-DD, and when a date is labelled with a format like (MM/DD/YYYY), parse it using that exact format:
- full_name
- first_name
- last_name
- date_of_birth
- country_of_birth
- street_address
- city
- state
- zip
- phone
- document_type (e.g. "I-94", "EAD", "Refugee Travel Document")
- issue_date
- expiration_date
- issuing_country

Return ONLY a JSON object with the field names as keys and extracted values as strings; omit any field you cannot read. No explanation. Example: {"full_name":"Jane Doe","date_of_birth":"1990-04-12","expiration_date":"2026-03-15"}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId, filePath, mimeType } = await req.json();
  if (!documentId || !filePath) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const isImage = typeof mimeType === "string" && mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(String(filePath));
  if (!isImage && !isPdf) {
    return NextResponse.json({ skipped: true, reason: "Unsupported file type for extraction." });
  }

  // Download (service client — file lives in the user's private bucket).
  const serviceClient = await createServiceClient();
  const { data: fileData, error: downloadError } = await serviceClient.storage
    .from("user-documents")
    .download(filePath);
  if (downloadError || !fileData) {
    return NextResponse.json({ error: "Could not download file" }, { status: 500 });
  }
  const buffer = Buffer.from(await fileData.arrayBuffer());

  // Build the content parts: PDFs go as-is; images are normalized first.
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
  if (isPdf) {
    const name = String(filePath).split("/").pop() || "document.pdf";
    parts.push(pdfPart(name.endsWith(".pdf") ? name : `${name}.pdf`, buffer.toString("base64")));
  } else {
    let data: Buffer = buffer;
    let media: "image/jpeg" | "image/png" | "image/gif" | "image/webp" =
      (mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp") ?? "image/jpeg";
    try {
      const norm = await normalizeImageForOcr(buffer);
      data = norm.data;
      media = norm.mediaType;
    } catch { /* fall back to original bytes */ }
    parts.push(imagePart(media, data.toString("base64")));
  }
  parts.push({ type: "text", text: PROMPT });

  let text = "{}";
  try {
    text = (await completeChat({ model: GPT, maxTokens: 600, user: parts })) || "{}";
  } catch {
    return NextResponse.json({ error: "Extraction failed" }, { status: 502 });
  }

  let extracted: Record<string, string> = {};
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const raw = start !== -1 && end > start ? text.slice(start, end + 1) : "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed)) {
      const key = k.toLowerCase();
      if (FORBIDDEN_FIELDS.includes(key)) continue;
      if (typeof v === "string" && v.trim()) extracted[key] = v.trim().slice(0, 120);
    }
  } catch {
    extracted = {};
  }

  await serviceClient.from("documents").update({ extracted_fields: extracted }).eq("id", documentId);

  return NextResponse.json({ extracted });
}
