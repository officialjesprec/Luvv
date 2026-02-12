
import { GoogleGenAI, Type } from "@google/genai";
import { Relationship, Tone } from "../types";

export const generateValentineMessages = async (
  recipientName: string,
  senderName: string,
  relationship: Relationship,
  tone: Tone
): Promise<string[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `You are an expert greeting card writer and emotional intelligence specialist. 
Your goal is to write three distinct Valentine's Day message options that feel deeply personal, avoid clichés, and perfectly match the social hierarchy and tone requested.`;

  const prompt = `Draft THREE distinct custom Valentine's Day messages based on the following variables:
- Recipient Name: ${recipientName}
- Sender Name: ${senderName}
- Relationship: ${relationship}
- Requested Tone: ${tone}

### WRITING RULES:
1. Word Count: Keep each message between 20 and 50 words.
2. Context: It is Valentine's Day.
3. Tone Nuance:
    - If "Romantic": Intimacy and connection.
    - If "Professional": Gratitude and value.
    - If "Pastor": Blessing and selfless love.
    - If "Funny": Lighthearted puns or jokes.
    - If "Friendly": Support and consistency.
4. Structure: Greeting -> Body -> Signature.

Return exactly THREE distinct options.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    const json = JSON.parse(response.text || "{}");
    if (json.messages && Array.isArray(json.messages)) {
      return json.messages;
    }
    throw new Error("Invalid response format");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [
      `To ${recipientName}, Wishing you a wonderful Valentine's Day filled with joy. You are truly appreciated. With love, ${senderName}`,
      `Dearest ${recipientName}, thank you for being such a wonderful part of my life. Happy Valentine's Day! Best, ${senderName}`,
      `Happy Valentine's Day, ${recipientName}! Sending you warmth and happiness today and always. From ${senderName}`
    ];
  }
};
