import { GoogleGenAI, Type } from "@google/genai";
import { Relationship, Tone } from "../types";
import { GeminiError } from "../error-classes";

export const generateValentineMessages = async (
  recipientName: string,
  senderName: string,
  relationship: Relationship,
  tone: Tone
): Promise<string[]> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("API Key not found. Please check your .env file.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are an expert greeting card writer and emotional intelligence specialist. 
Your goal is to write three distinct Valentine's Day message options that feel deeply personal, avoid clichés, and perfectly match the social hierarchy and tone requested.`;

  const prompt = `Write a ${tone} Valentine's message to my ${relationship} named ${recipientName}. The message should be signed from ${senderName}. Keep it max of 150 words.

Return exactly THREE distinct options in JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.9, // Higher temperature for more diversity in the 3 options
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            messages: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of three distinct Valentine's messages.",
              minItems: 3,
              maxItems: 3
            }
          },
          required: ["messages"]
        }
      },
    });

    let json: any;
    try {
      const rawText = response.text || "{}";
      const cleanText = rawText.replace(/```json|```/g, "").trim();
      json = JSON.parse(cleanText);
    } catch (e) {
      throw new GeminiError("Failed to parse AI response. The creative spirit hit a glitch.", { rawResponse: response.text });
    }

    if (json.messages && Array.isArray(json.messages) && json.messages.length >= 3) {
      return json.messages.slice(0, 3);
    }

    throw new GeminiError("Incomplete message set received from AI. Selecting fallback options.", { json });
  } catch (error: any) {
    if (error instanceof GeminiError) throw error;

    console.error("Gemini API Error:", error);
    return [
      `To ${recipientName}, Wishing you a wonderful Valentine's Day filled with joy. You are truly appreciated. With love, ${senderName}`,
      `Dearest ${recipientName}, thank you for being such a wonderful part of my life. Happy Valentine's Day! Best, ${senderName}`,
      `Happy Valentine's Day, ${recipientName}! Sending you warmth and happiness today and always. From ${senderName}`
    ];
  }
};
