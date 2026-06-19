import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { cvText, jobRequirements } = await request.json()

    const prompt = `You are an HR AI assistant for a logistics company in Egypt. 
Analyze this CV and return a JSON object with exactly this structure:

{
  "full_name": "candidate full name",
  "location": "city, country",
  "exp_years": number,
  "salary_expect": "expected salary or unknown",
  "availability": "immediate / X weeks notice / unknown",
  "skills": {
    "license_class": "license class or null",
    "years_exp": number,
    "hazmat": true/false,
    "medical": "status or unknown",
    "gps_exp": true/false,
    "arabic": true/false
  },
  "match_score": number between 0-100 based on these job requirements: ${JSON.stringify(jobRequirements)},
  "ai_summary": "2-3 sentence professional summary of the candidate",
  "red_flags": ["flag1", "flag2"] or empty array
}

CV Text:
${cvText}

Return ONLY the JSON object, no other text.`

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    })

    const content = completion.choices[0].message.content ?? "{}"
    const clean = content.replace(/```json|```/g, "").trim()
    const result = JSON.parse(clean)

    return NextResponse.json(result)
  } catch (error) {
    console.error("CV analysis error:", error)
    return NextResponse.json({ error: "Failed to analyze CV" }, { status: 500 })
  }
}
