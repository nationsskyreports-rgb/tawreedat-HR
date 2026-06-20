import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured. Add it in Vercel environment variables." },
        { status: 500 }
      )
    }

    const { cvText, jobRequirements } = await request.json()

    if (!cvText || typeof cvText !== "string" || cvText.trim().length < 50) {
      return NextResponse.json(
        { error: "CV text is too short or missing. Make sure the file was parsed correctly." },
        { status: 400 }
      )
    }

    const prompt = `You are an HR AI assistant for a logistics company in Egypt.
Analyze the CV below and return ONLY a JSON object with this exact structure (no extra text, no markdown):

{
  "full_name": "candidate full name",
  "location": "city, country",
  "exp_years": <number>,
  "salary_expect": "expected salary or 'unknown'",
  "availability": "immediate / X weeks notice / unknown",
  "skills": {
    "license_class": "license class or null",
    "years_exp": <number>,
    "hazmat": "yes/no/null",
    "medical": "valid/expired/null",
    "gps_exp": "yes/no/null",
    "arabic": "native/fluent/basic/null"
  },
  "match_score": <number from 0 to 100>,
  "ai_summary": "2-3 sentence professional summary of the candidate",
  "red_flags": ["array of concerns, e.g. employment gaps, missing certifications"]
}

JOB REQUIREMENTS:
${JSON.stringify(jobRequirements ?? {}, null, 2)}

CV TEXT:
${cvText.slice(0, 8000)}

Return ONLY valid JSON. No code blocks, no explanations.`

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    })

    const content = completion.choices[0]?.message?.content ?? "{}"

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (parseErr) {
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: content },
        { status: 502 }
      )
    }

    // Sanity defaults
    parsed.full_name = parsed.full_name ?? "Unknown"
    parsed.location = parsed.location ?? "Unknown"
    parsed.exp_years = Number(parsed.exp_years ?? 0)
    parsed.match_score = Math.max(0, Math.min(100, Number(parsed.match_score ?? 50)))
    parsed.red_flags = Array.isArray(parsed.red_flags) ? parsed.red_flags : []
    parsed.skills = parsed.skills && typeof parsed.skills === "object" ? parsed.skills : {}
    parsed.ai_summary = parsed.ai_summary ?? "No summary available"

    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error("CV analysis error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unknown error analyzing CV" },
      { status: 500 }
    )
  }
}
