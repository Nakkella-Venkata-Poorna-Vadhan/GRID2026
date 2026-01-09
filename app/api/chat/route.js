import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// ✅ FIXED: Using your specific API Key
const genAI = new GoogleGenerativeAI("AIzaSyDRhQWMjIPFt0kl-k94XmzBfvuR1gLlSrk");

export async function POST(req) {
  try {
    const { message, groupData } = await req.json();

    // 1. Define the AI's Personality & Knowledge Base
    const systemPrompt = `
      You are "HackOS AI", a futuristic, helpful, but slightly robotic assistant for a Hackathon platform.
      
      CONTEXT:
      - The user is Unit ${groupData?.user_id || "Unknown"}.
      - Current Status: ${groupData?.status || "Active"}.
      
      RULES FOR STUDENTS:
      1. **Profile:** They must enter 2 member names and upload 2 photos.
      2. **GitHub:** They must link a repo in this format: https://github.com/USERNAME/${groupData?.user_id || "GXX"}_Hackathon_Jan
      3. **Zip:** They must upload a final ZIP file of their code.
      4. **Submission:** The "Complete Hackathon" button only works when all above are done.
      5. **Help:** If they are stuck technically, tell them to click the "RAISE HAND" button.
      
      INSTRUCTIONS:
      - Keep answers short (under 50 words).
      - Use a cool, sci-fi tone (e.g., "Affirmative," "Processing," "Data received").
      - Do not hallucinate features that don't exist.
    `;

    // 2. Call Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "System Instructions: " + systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "System Online. Protocols loaded. Ready to assist Unit." }],
        },
      ],
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ reply: text });

  } catch (error) {
    // This logs the specific error to your VS Code terminal
    console.error("AI Error:", error); 
    return NextResponse.json({ reply: "Connection Error. Unable to reach neural net." }, { status: 500 });
  }
}