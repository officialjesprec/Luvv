
/// <reference types="@cloudflare/workers-types" />

interface Env {
    DB: D1Database;
    GEMINI_API_KEY: string;
    GROQ_API_KEY: string;
}

interface RequestBody {
    relationship: string;
    tone: string;
    recipient: string;
    sender: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;

    // 1. Parse Request
    let body: RequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return new Response('Invalid JSON', { status: 400 });
    }

    const { relationship, tone, recipient, sender } = body;
    if (!relationship || !tone) {
        return new Response('Missing relationship or tone', { status: 400 });
    }

    // 2. CHECK CACHE (D1)
    try {
        const cached = await env.DB.prepare(
            'SELECT message_text FROM Message_Library WHERE relationship = ? AND tone = ? ORDER BY RANDOM() LIMIT 1'
        )
            .bind(relationship, tone)
            .first<{ message_text: string }>();

        if (cached) {
            return new Response(
                JSON.stringify({ messages: [cached.message_text], provider: 'cache - d1' }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }
    } catch (err) {
        console.error('D1 Read Error:', err);
        // Continue to AI if D1 fails
    }

    // 3. AI FAILOVER SYSTEM
    const prompt = `You are a professional romantic writer for Luvv. Write a short, soulful message based on the relationship and tone provided. Max 400 words.
  Context: ${relationship}, Tone: ${tone}, To: ${recipient}, From: ${sender}.
  Return only the message text.`;

    let message: string | null = null;
    let provider = '';

    // Attempt 1: Gemini
    if (!message && env.GEMINI_API_KEY) {
        try {
            console.log('Trying Gemini...');
            const geminiResp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
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
    if (!message && env.GROQ_API_KEY) {
        try {
            console.log('Gemini failed. Trying Groq...');
            const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.GROQ_API_KEY}`,
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
        return new Response(
            JSON.stringify({ error: "Cupid's ink ran dry. All models failed." }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 4. SAVE TO D1 (Async)
    // We don't await this to speed up the response
    if (provider !== 'cache') {
        context.waitUntil(
            env.DB.prepare(
                'INSERT INTO Message_Library (relationship, tone, message_text, provider) VALUES (?, ?, ?, ?)'
            )
                .bind(relationship, tone, message, provider)
                .run()
                .then(() => console.log('Saved to D1'))
                .catch((err) => console.error('D1 Save Error:', err))
        );
    }

    return new Response(
        JSON.stringify({ messages: [message], provider: provider }),
        { headers: { 'Content-Type': 'application/json' } }
    );
};
