import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'supabase';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeMessages(msgs: any[]): string[] {
    return msgs.map(m => {
        // If it's an object, try to find a text field
        if (typeof m === 'object' && m !== null) {
            return m.message || m.text || m.content || JSON.stringify(m);
        }

        if (typeof m !== 'string') return String(m);

        const trimmed = m.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                return parsed.message || parsed.text || parsed.content || trimmed;
            } catch {
                return trimmed;
            }
        }
        return trimmed;
    });
}

// Convert actual names to placeholders for safe database storage
function sanitizeToTemplate(msgs: string[], recipient: string, sender: string): string[] {
    return msgs.map(m => {
        // Create regex that is case insensitive and handles potential punctuation around names
        const rRegex = new RegExp(`\\b${recipient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const sRegex = new RegExp(`\\b${sender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        return m.replace(rRegex, '[RECIPIENT]').replace(sRegex, '[SENDER]');
    });
}

// Convert placeholders back to actual names for the user
function personalizeMessages(msgs: string[], recipient: string, sender: string): string[] {
    return msgs.map(m => {
        return m.replace(/\[RECIPIENT\]/g, recipient).replace(/\[SENDER\]/g, sender);
    });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { recipient, sender, relationship, tone } = await req.json();

        if (!recipient || !sender || !relationship || !tone) {
            throw new Error('Missing required fields');
        }

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            console.error('CRITICAL: Supabase environment variables are missing');
            throw new Error('Internal Server Error: Missing configuration');
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Check Cache (using lowercase table name)
        const { data: cachedMessages, error: cacheError } = await supabase
            .from('message_library')
            .select('message_text')
            .eq('relationship', relationship)
            .eq('tone', tone)
            .limit(3);

        if (cacheError) {
            console.error('Database Cache Error:', cacheError.message);
        }

        if (!cacheError && cachedMessages && cachedMessages.length >= 3) {
            console.log('Cache Hit');
            const templates = cachedMessages.map(m => m.message_text);
            const personalized = personalizeMessages(templates, recipient, sender);
            return new Response(
                JSON.stringify({ messages: personalized, provider: 'cache' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. AI FAILOVER SYSTEM
        const prompt = `Write a deep, heartfelt, and highly expressive ${tone} Valentine's message to my ${relationship}. 
        Length: Around 200 words (a love letter style).
        Structure: Use multiple paragraphs and include beautiful, relevant emojis throughout to make it feel human and modern.
        Placeholders: Use [RECIPIENT] for the recipient's name and [SENDER] for the sender's name.
        The message should be signed from [SENDER].
        Return exactly THREE distinct options in JSON format with a key "messages" containing an array of strings.
        Crucial: Use the literal strings "[RECIPIENT]" and "[SENDER]" in the text.`;

        let messages: string[] = [];
        let provider = '';

        // Attempt 1: Gemini
        if (GEMINI_API_KEY) {
            try {
                console.log('Trying Gemini...');
                const geminiResp = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                responseMimeType: "application/json",
                            }
                        }),
                    }
                );

                if (geminiResp.ok) {
                    const geminiData = await geminiResp.json() as any;
                    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (rawText) {
                        const parsed = JSON.parse(rawText);
                        if (parsed.messages && Array.isArray(parsed.messages)) {
                            messages = normalizeMessages(parsed.messages);
                            provider = 'gemini-1.5-flash';
                        }
                    }
                } else {
                    console.error('Gemini API Error:', await geminiResp.text());
                }
            } catch (e) {
                console.error('Gemini Exception:', e);
            }
        }

        // Attempt 2: Groq (Failover)
        if (messages.length === 0 && GROQ_API_KEY) {
            try {
                console.log('Gemini failed or skipped. Trying Groq...');
                const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        messages: [
                            { role: 'system', content: 'You are a professional romantic writer. Return JSON only.' },
                            { role: 'user', content: prompt },
                        ],
                        response_format: { type: "json_object" }
                    }),
                });

                if (groqResp.ok) {
                    const groqData = await groqResp.json() as any;
                    const content = groqData.choices?.[0]?.message?.content;
                    if (content) {
                        const parsedValue = JSON.parse(content);
                        if (parsedValue.messages && Array.isArray(parsedValue.messages)) {
                            messages = normalizeMessages(parsedValue.messages);
                            provider = 'groq-llama-3.1';
                        }
                    }
                } else {
                    console.error('Groq API Error:', await groqResp.text());
                }
            } catch (e) {
                console.error('Groq Exception:', e);
            }
        }

        if (messages.length === 0) {
            console.log('AI models failed. Attempting random DB fallback...');
            try {
                const { data: randomMessages, error: randomError } = await supabase
                    .from('message_library')
                    .select('message_text')
                    .eq('relationship', relationship)
                    .eq('tone', tone)
                    .limit(3);

                if (randomError) {
                    console.error('Database Random Fallback Error:', randomError.message);
                }

                if (!randomError && randomMessages && randomMessages.length > 0) {
                    messages = randomMessages.map(m => m.message_text);
                    provider = 'db-fallback-random';
                }
            } catch (e) {
                console.error('Fallback Exception:', e);
            }
        }

        if (messages.length === 0) {
            throw new Error('All AI models and fallbacks failed to generate messages');
        }

        // 3. Save to DB (Immediate)
        // We only save if it's new AI content (not from cache or fallback)
        if (provider.includes('gemini') || provider.includes('groq')) {
            // First normalize (unbox JSON) then sanitize (replace names with placeholders if AI used them)
            const templateMessages = sanitizeToTemplate(messages, recipient, sender);

            const dbEntries = templateMessages.map((txt: string) => ({
                relationship,
                tone,
                message_text: txt,
                provider: provider
            }));

            const { error: insertError } = await supabase.from('message_library').insert(dbEntries);

            if (insertError) {
                console.error('Database Insert ERROR:', insertError.message);
            } else {
                console.log('Successfully saved to DB');
            }

            // Always personalize before returning to frontend
            messages = personalizeMessages(templateMessages, recipient, sender);
        } else if (provider === 'db-fallback-random') {
            // Personalize the fallback messages too
            messages = personalizeMessages(messages, recipient, sender);
        }

        return new Response(
            JSON.stringify({ messages, provider }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Final Edge Function Error:', error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
