import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import OpenAI from "openai";

const getClient = () =>
  new OpenAI({
    baseURL: "https://models.github.ai/inference",
    apiKey: process.env.GITHUB_TOKEN,
  });

async function extractPdfText(buffer: Buffer): Promise<string> {
  const mod = await (Function('return import("pdf-parse")')() as Promise<{
    PDFParse: new (opts: { data: Uint8Array }) => {
      load: () => Promise<unknown>;
      getText: () => Promise<string>;
    };
  }>);
  const parser = new mod.PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  return await parser.getText();
}

export async function POST(request: Request) {
  try {
    const { fileUrl } = await request.json();

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl required" }, { status: 400 });
    }

    const filepath = path.join(process.cwd(), "public", fileUrl);
    const buffer = await readFile(filepath);

    let text: string;
    try {
      const rawText = await extractPdfText(buffer);
      // getText() may return various formats
      if (Array.isArray(rawText)) {
        text = (rawText as string[]).join("\n");
      } else if (typeof rawText === "object" && rawText !== null) {
        const pages = (rawText as { pages?: { text?: string }[] }).pages;
        if (Array.isArray(pages)) {
          text = pages.map((p) => p.text || "").join("\n\n");
        } else {
          text = JSON.stringify(rawText);
        }
      } else {
        text = String(rawText || "");
      }
      console.log("PDF text extracted, length:", text.length, "preview:", text.slice(0, 300));
    } catch (e) {
      console.error("PDF parse error:", e);
      return NextResponse.json({
        error: "Could not extract text from PDF. It may be image-based. Please enter values manually.",
      }, { status: 422 });
    }

    if (!text || text.trim().length < 20) {
      return NextResponse.json({
        error: "Could not extract text from PDF. It may be image-based. Please enter values manually.",
      }, { status: 422 });
    }

    const client = getClient();
    const response = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a DEXA scan data extraction assistant. Extract structured body composition data from a DEXA scan report.

Return JSON with ALL of these fields (use null if not found):
{
  "scanDate": "YYYY-MM-DD" or null,
  "totalWeightLbs": number or null (total body weight),
  "bodyFatPct": number or null (total body fat %, typically 10-45),
  "leanMassLbs": number or null (total lean/muscle mass in lbs),
  "fatMassLbs": number or null (total fat mass in lbs),
  "boneMassLbs": number or null (bone mineral content in lbs),
  "visceralFat": number or null,
  "trunkFatPct": number or null,
  "armsFatPct": number or null,
  "legsFatPct": number or null,
  "trunkLeanLbs": number or null (trunk lean mass in lbs),
  "armsLeanLbs": number or null (arms combined lean mass in lbs),
  "legsLeanLbs": number or null (legs combined lean mass in lbs),
  "trunkFatLbs": number or null (trunk fat mass in lbs),
  "armsFatLbs": number or null (arms combined fat mass in lbs),
  "legsFatLbs": number or null (legs combined fat mass in lbs),
  "androidFatPct": number or null (android/abdominal region fat %),
  "gynoidFatPct": number or null (gynoid/hip region fat %),
  "agRatio": number or null (android/gynoid ratio),
  "bmdGcm2": number or null (bone mineral density in g/cm², usually 0.8-1.4),
  "tScore": number or null (T-score for bone density, usually -3 to +3),
  "bmr": number or null (basal metabolic rate or RMR in kcal/day — ONLY if explicitly stated in the report, do NOT calculate),
  "confidence": "high" | "medium" | "low"
}

CRITICAL RULES:
- bodyFatPct is a PERCENTAGE (e.g., 22.5), NOT a mass. Should be 5-50%.
- leanMassLbs is lean tissue only (not total weight). Typically 90-170 lbs.
- fatMassLbs is fat only. Typically 15-80 lbs.
- totalWeightLbs = leanMassLbs + fatMassLbs + boneMassLbs. Use as sanity check.
- For regional values: "Arms" = left arm + right arm combined. "Legs" = left leg + right leg combined.
- UNIT CONVERSIONS: grams ÷ 1000 = kg. kg × 2.20462 = lbs. If already in lbs, use as-is.
- Look for "Total" or "Whole Body" row for overall values.
- DO NOT confuse total weight with lean mass.
- Extract as many fields as you can find. Use null only when truly not present.`,
        },
        {
          role: "user",
          content: `Extract DEXA scan data from this report. Look through ALL the text carefully — the numbers may be in tables or scattered throughout.\n\n${text.slice(0, 8000)}`,
        },
      ],
    });

    const resultText = response.choices[0]?.message?.content || "{}";
    let extracted;
    try {
      extracted = JSON.parse(resultText);
    } catch {
      return NextResponse.json({
        error: "Failed to parse extraction results.",
        rawText: text.slice(0, 500),
      }, { status: 422 });
    }

    return NextResponse.json({
      extracted,
      rawTextPreview: text.slice(0, 500),
    });
  } catch (error) {
    console.error("DEXA parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse DEXA scan. Try entering values manually." },
      { status: 500 }
    );
  }
}
