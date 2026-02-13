import { Relationship, Tone } from "../types";
import { GeminiError } from "../error-classes";
import { supabase } from "./supabase";

export const generateValentineMessages = async (
    recipientName: string,
    senderName: string,
    relationship: Relationship,
    tone: Tone
): Promise<string[]> => {
    try {
        const { data, error } = await supabase.functions.invoke('generate-luvv', {
            body: {
                recipient: recipientName,
                sender: senderName,
                relationship: relationship,
                tone: tone
            }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        return data.messages;

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
