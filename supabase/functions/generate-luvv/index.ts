import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Helper Functions ---

function normalizeMessages(msgs: any[]): string[] {
    return msgs.map(m => {
        if (typeof m === 'object' && m !== null) {
            return m.message || m.text || m.content || JSON.stringify(m);
        }
        if (typeof m !== 'string') return String(m);
        const trimmed = m.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                return parsed.message || parsed.text || parsed.content || trimmed;
            } catch { return trimmed; }
        }
        return trimmed;
    });
}

function sanitizeToTemplate(msgs: string[], recipient: string, sender: string): string[] {
    return msgs.map(m => {
        const rRegex = new RegExp(`\\b${recipient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const sRegex = new RegExp(`\\b${sender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        return m.replace(rRegex, '[RECIPIENT]').replace(sRegex, '[SENDER]');
    });
}

function personalizeMessages(msgs: string[], recipient: string, sender: string): string[] {
    return msgs.map(m => m.replace(/\[RECIPIENT\]/g, recipient).replace(/\[SENDER\]/g, sender));
}

// --- Main Server ---

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { recipient, sender, relationship, tone } = await req.json();

        if (!recipient || !sender || !relationship || !tone) {
            throw new Error('Missing required fields');
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. CHECK CACHE FIRST
        const { data: cachedMessages, error: cacheError } = await supabase
            .from('message_library')
            .select('message_text')
            .eq('relationship', relationship)
            .eq('tone', tone)
            .limit(3);

        if (!cacheError && cachedMessages && cachedMessages.length >= 3) {
            console.log('Cache Hit');
            const templates = cachedMessages.map(m => m.message_text);
            const personalized = personalizeMessages(templates, recipient, sender);
            return new Response(
                JSON.stringify({ messages: personalized, provider: 'cache' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. CHECK AI USAGE LIMIT (250/day)
        const today = new Date().toISOString().split('T')[0];
        const { count: geminiCount } = await supabase
            .from('ai_usage_logs')
            .select('*', { count: 'exact', head: true })
            .eq('model_name', 'gemini')
            .eq('status', 'success')
            .gte('created_at', today);

        const prompt = `Write a deep, heartfelt, and highly expressive ${tone} Valentine's message to my ${relationship}. 
        Length: Around 200 words. Placeholders: Use [RECIPIENT] and [SENDER].
        Return exactly THREE distinct options in a JSON array named "messages".`;

        let messages: string[] = [];
        let provider = '';

        // 3. ATTEMPT 1: GEMINI (Only if under limit)
        if (GEMINI_API_KEY && (geminiCount ?? 0) < 250) {
            try {
                console.log(`Trying Gemini (Usage: ${geminiCount}/250)...`);
                const geminiResp = await fetch(
                    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                            // Removed responseMimeType to prevent 400 error
                        }),
                    }
                );

                if (geminiResp.ok) {
                    const geminiData = await geminiResp.json();
                    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (rawText) {
                        // Find JSON inside potential markdown code blocks
                        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
                        if (parsed.messages) {
                            messages = normalizeMessages(parsed.messages);
                            provider = 'gemini-2.5-flash';
                        }
                    }
                } else {
                    console.error('Gemini Error:', await geminiResp.text());
                }
            } catch (e) {
                console.error('Gemini Exception:', e);
            }
        }

        // 4. ATTEMPT 2: GROQ (Fallback)
        if (messages.length === 0 && GROQ_API_KEY) {
            console.log('Using Groq Failover...');
            try {
                const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        messages: [
                            { role: 'system', content: 'Return JSON only with key "messages".' },
                            { role: 'user', content: prompt },
                        ],
                        response_format: { type: "json_object" }
                    }),
                });

                if (groqResp.ok) {
                    const groqData = await groqResp.json();
                    const content = groqData.choices?.[0]?.message?.content;
                    if (content) {
                        const parsedValue = JSON.parse(content);
                        messages = normalizeMessages(parsedValue.messages);
                        provider = 'groq-llama-3.1';
                    }
                }
            } catch (e) { console.error('Groq Exception:', e); }
        }

        // 5. FINAL FALLBACK: RANDOM DB
        if (messages.length === 0) {
            console.log('All AI failed. Picking random from DB...');
            const { data: randomMessages } = await supabase
                .from('message_library')
                .select('message_text')
                .eq('relationship', relationship)
                .eq('tone', tone)
                .limit(3);
            
            if (randomMessages) {
                messages = randomMessages.map(m => m.message_text);
                provider = 'db-fallback-random';
            }
        }

        if (messages.length === 0) throw new Error('Generation failed');

        // 6. SAVE & PERSONALIZE
        if (provider.includes('gemini') || provider.includes('groq')) {
            const templateMessages = sanitizeToTemplate(messages, recipient, sender);
            const dbEntries = templateMessages.map(txt => ({
                relationship, tone, message_text: txt, provider
            }));

            await supabase.from('message_library').insert(dbEntries);
            await supabase.from('ai_usage_logs').insert({ 
                model_name: provider.includes('gemini') ? 'gemini' : 'groq', 
                status: 'success' 
            });
            
            messages = personalizeMessages(templateMessages, recipient, sender);
        } else {
            messages = personalizeMessages(messages, recipient, sender);
        }

        return new Response(
            JSON.stringify({ messages, provider }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
