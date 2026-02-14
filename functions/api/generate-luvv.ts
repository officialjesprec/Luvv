
import { createClient } from '@supabase/supabase-js';

interface RequestBody {
    relationship: string;
    tone: string;
    recipient: string;
    sender: string;
}

export const generateLuvv = async (body: RequestBody) => {
    // 1. Initialize Supabase (Using env variables)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { relationship, tone, recipient, sender } = body;
    if (!relationship || !tone) {
        throw new Error('Missing relationship or tone');
    }

    // 2. CHECK CACHE (Supabase)
    try {
        const { data: cached, error: cacheError } = await supabase
            .from('message_library')
            .select('message_text')
            .eq('relationship', relationship)
            .eq('tone', tone)
            .limit(1)
            .single();

        if (cached) {
            return { messages: [cached.message_text], provider: 'cache - supabase' };
        }
    } catch (err) {
        console.error('Supabase Read Error:', err);
        // Continue to AI if cache lookup fails
    }

    // 3. AI FAILOVER SYSTEM
    const prompt = `You are a professional writer for Luvv. Write a short, soulful message based on the relationship and tone provided. Max 150 words.
  Context: ${relationship}, Tone: ${tone}, To: ${recipient}, From: ${sender}.
  Return only the message text.`;

    let message: string | null = null;
    let provider = '';

    // Attempt 1: Gemini
    if (!message && process.env.VITE_GEMINI_API_KEY) {
        try {
            console.log('Trying Gemini...');
            const geminiResp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.VITE_GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                }
            );

            if (geminiResp.ok) {
                const data: any = await geminiResp.json();
                message = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
                if (message) provider = 'gemini-1.5-flash';
            } else {
                console.error('Gemini API Error:', geminiResp.statusText);
            }
        } catch (e) {
            console.error('Gemini Exception:', e);
        }
    }

    // Attempt 2: Groq (Llama 3.1)
    if (!message && process.env.VITE_GROQ_API_KEY) {
        try {
            console.log('Gemini failed. Trying Groq...');
            const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.VITE_GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: 'You are a professional writer.' },
                        { role: 'user', content: prompt },
                    ],
                }),
            });

            if (groqResp.ok) {
                const data: any = await groqResp.json();
                message = data?.choices?.[0]?.message?.content || null;
                if (message) provider = 'groq-llama-3.1';
            }
        } catch (e) {
            console.error('Groq Exception:', e);
        }
    }

    if (!message) {
        throw new Error("Cupid's ink ran dry. All models failed.");
    }

    // 4. SAVE TO Supabase (Async)
    if (provider !== 'cache') {
        try {
            await supabase
                .from('message_library')
                .insert({
                    relationship,
                    tone,
                    message_text: message,
                    provider
                });
            console.log('Saved to Supabase');
        } catch (err) {
            console.error('Supabase Save Error:', err);
        }
    }

    return { messages: [message], provider: provider };
};

