
import { Relationship, Tone } from "../types";
import { GeminiError } from "../error-classes";

export const generateValentineMessages = async (
    recipientName: string,
    senderName: string,
    relationship: Relationship,
    tone: Tone
): Promise<string[]> => {
    try {
        const response = await fetch('/api/generate-luvv', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient: recipientName,
                sender: senderName,
                relationship,
                tone
            }),
        });

        if (!response.ok) {
            const error: any = await response.json().catch(() => ({}));
            throw new Error(error.error || `Server Error: ${response.status}`);
        }

        const data: any = await response.json();

        // Log the provider for analytics
        if (data.provider) {
            console.log(`Message generated via: ${data.provider}`);
        }

        if (data.messages && Array.isArray(data.messages)) {
            return data.messages;
        }

        throw new GeminiError("Invalid response format from server.");

    } catch (error: any) {
        console.error("Luvv Generation Error:", error);
        // Fallback messages for extreme failure cases
        return [
            `To ${recipientName}, Wishing you a wonderful Valentine's Day filled with joy. You are truly appreciated. With love, ${senderName}`,
            `Dearest ${recipientName}, thank you for being such a wonderful part of my life. Happy Valentine's Day! Best, ${senderName}`,
            `Happy Valentine's Day, ${recipientName}! Sending you warmth and happiness today and always. From ${senderName}`
        ];
    }
};
