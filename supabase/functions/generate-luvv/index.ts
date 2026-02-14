import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- HELPER FUNCTIONS (RE-INCLUDED FOR SAFETY) ---

function normalizeMessages(msgs: any[]): string[] {
    return msgs.map(m => {
        if (typeof m === 'object' && m !== null) {
            return m.message || m.text || m.content || JSON.stringify(m);
        }
        return typeof m === 'string' ? m.trim() : String(m);
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

// Robust JSON Extractor: Finds the JSON array even if the AI adds conversational text
function extractMessages(text: string): string[] {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const msgs = Array.isArray(parsed) ? parsed : (parsed.messages || parsed.choices);
            if (Array.isArray(msgs)) return normalizeMessages(msgs);
        }
    } catch (e) {
        console.error("Regex Parse Failed, falling back to raw split");
    }
    // Final fallback: If not JSON, split by double newlines
    return text.split(/\n\n+/).filter(t => t.length > 20).slice(0, 3);
}

// --- MAIN SERVER ---

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { recipient, sender, relationship, tone } = await req.json();
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Context-aware prompt logic to ensure appropriateness
        const romanticRelationships = ['Spouse', 'Girlfriend', 'Boyfriend', 'Crush'];
        const professionalRelationships = ['Employer', 'Customer'];
        const platonicRelationships = ['Male Friend', 'Female Friend', 'Pastor', 'Father', 'Mother', 'Sister', 'Brother', 'Cousin'];

        let contextInstruction = '';
        let messageType = 'Valentine\'s messages';

        if (romanticRelationships.includes(relationship)) {
            contextInstruction = "Write deep, soulful, and romantic love letters expressing intense affection.";
            messageType = 'love letters';
        } else if (professionalRelationships.includes(relationship)) {
            contextInstruction = "Write professional, respectful, and appreciative messages. DO NOT use any romantic or flirtatious language. Maintain healthy professional boundaries.";
            messageType = 'professional appreciation letters';
        } else if (relationship === 'Ex') {
            contextInstruction = "Write thoughtful, balanced, and mature messages. Avoid romantic sentiment and avoid hostility. Keep it civil and reflective.";
            messageType = 'reflective messages';
        } else if (platonicRelationships.includes(relationship)) {
            // Platonic or Family
            contextInstruction = "Write heartfelt, appreciative, and warm messages. Focus on the value of the bond and shared connection. DO NOT use romantic or sexual language.";
            messageType = 'heartfelt messages';
        }

        const prompt = `Task: ${contextInstruction}
        Write 3 ${tone} ${messageType} (around 150 words each) for my ${relationship}. 
        Relationship Context: ${relationship}
        Selected Tone: ${tone}
        
        Use [RECIPIENT] and [SENDER] as placeholders. 
        IMPORTANT: The content MUST strictly follow the relationship context. If the relationship is not romantic (like Boss, Customer, or Pastor), the message MUST BE STRICTLY NON-ROMANTIC.
        Return ONLY a valid JSON object with the key "messages" containing an array of the 3 strings.`;

        // === ROUND-ROBIN LOAD BALANCER ===
        const PROVIDER_ROTATION_KEY = 'provider_rotation';
        let providerRotation = (globalThis as any)[PROVIDER_ROTATION_KEY] || 0;
        const providers = ['gemini-flash', 'gemini-flash-lite', 'groq-8b', 'groq-70b'];

        function getNextProvider() {
            const currentProvider = providers[providerRotation % providers.length];
            providerRotation++;
            (globalThis as any)[PROVIDER_ROTATION_KEY] = providerRotation;
            return currentProvider;
        }

        // === RETRY LOGIC WITH EXPONENTIAL BACKOFF ===
        async function tryProviderWithRetry(providerFn: () => Promise<any>, providerName: string, maxRetries = 2) {
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const result = await providerFn();
                    if (result) return result;
                } catch (e) {
                    console.error(`${providerName} attempt ${attempt + 1} failed:`, e);
                    if (attempt < maxRetries - 1) {
                        const backoffMs = 1000 * Math.pow(2, attempt);
                        console.log(`Retrying ${providerName} in ${backoffMs}ms...`);
                        await new Promise(r => setTimeout(r, backoffMs));
                    }
                }
            }
            return null;
        }

        let messages: string[] = [];
        let provider = '';

        // --- GEMINI 2.5 FLASH (20 req/day, high quality) ---
        async function tryGeminiFlash() {
            if (!GEMINI_API_KEY) return null;
            console.log("Attempting Gemini 2.5 Flash...");
            try {
                const geminiResp = await fetch(
                    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                    }
                );

                if (geminiResp.ok) {
                    const data = await geminiResp.json();
                    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    const msgs = extractMessages(rawText);
                    if (msgs.length > 0) {
                        console.log("Gemini Flash Success!");
                        return { messages: msgs, provider: 'gemini-2.5-flash' };
                    }
                }
                const errText = await geminiResp.text();
                console.error("Gemini Flash API Error:", geminiResp.status, errText);
            } catch (e) { console.error('Gemini Flash Fetch Failed:', e); }
            return null;
        }

        // --- GEMINI 2.5 FLASH-LITE (1,000 req/day) ---
        async function tryGeminiFlashLite() {
            if (!GEMINI_API_KEY) return null;
            console.log("Attempting Gemini 2.5 Flash-Lite...");
            try {
                const geminiResp = await fetch(
                    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                    }
                );

                if (geminiResp.ok) {
                    const data = await geminiResp.json();
                    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    const msgs = extractMessages(rawText);
                    if (msgs.length > 0) {
                        console.log("Gemini Flash-Lite Success!");
                        return { messages: msgs, provider: 'gemini-2.5-flash-lite' };
                    }
                }
                const errText = await geminiResp.text();
                console.error("Gemini Flash-Lite API Error:", geminiResp.status, errText);
            } catch (e) { console.error('Gemini Flash-Lite Fetch Failed:', e); }
            return null;
        }


        // --- GROQ LLAMA 3.1 8B (Fast, 14,400 req/day) ---
        async function tryGroq8B() {
            if (!GROQ_API_KEY) return null;
            console.log("Attempting Groq Llama 3.1 8B...");
            try {
                const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        messages: [{ role: 'user', content: prompt }],
                        response_format: { type: "json_object" }
                    }),
                });
                if (groqResp.ok) {
                    const data = await groqResp.json();
                    const msgs = extractMessages(data.choices[0].message.content);
                    if (msgs.length > 0) {
                        console.log("Groq 8B Success!");
                        return { messages: msgs, provider: 'groq-llama-3.1-8b' };
                    }
                }
                const errText = await groqResp.text();
                console.error("Groq 8B API Error:", groqResp.status, errText);
            } catch (e) { console.error('Groq 8B Fetch Failed:', e); }
            return null;
        }

        // --- GROQ LLAMA 3.3 70B (High capability, 14,400 req/day) ---
        async function tryGroq70B() {
            if (!GROQ_API_KEY) return null;
            console.log("Attempting Groq Llama 3.3 70B...");
            try {
                const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [{ role: 'user', content: prompt }],
                        response_format: { type: "json_object" }
                    }),
                });
                if (groqResp.ok) {
                    const data = await groqResp.json();
                    const msgs = extractMessages(data.choices[0].message.content);
                    if (msgs.length > 0) {
                        console.log("Groq 70B Success!");
                        return { messages: msgs, provider: 'groq-llama-3.3-70b' };
                    }
                }
                const errText = await groqResp.text();
                console.error("Groq 70B API Error:", groqResp.status, errText);
            } catch (e) { console.error('Groq 70B Fetch Failed:', e); }
            return null;
        }

        // === LOAD BALANCING LOGIC ===
        const primaryProvider = getNextProvider();
        console.log(`🎯 Load Balancer: Routing to ${primaryProvider}`);

        // Provider map
        const providerMap: Record<string, () => Promise<any>> = {
            'gemini-flash': tryGeminiFlash,
            'gemini-flash-lite': tryGeminiFlashLite,
            'groq-8b': tryGroq8B,
            'groq-70b': tryGroq70B
        };

        let result = await tryProviderWithRetry(providerMap[primaryProvider], primaryProvider);

        // If primary fails, try others in rotation
        if (!result) {
            console.log(`${primaryProvider} failed, trying other providers...`);
            for (const providerName of providers) {
                if (providerName !== primaryProvider) {
                    result = await tryProviderWithRetry(providerMap[providerName], providerName);
                    if (result) break;
                }
            }
        }

        if (result) {
            messages = result.messages;
            provider = result.provider;
        }

        // --- DATABASE SAFETY NET ---
        if (messages.length === 0) {
            console.log('AI models unavailable. Consulting Database Backup Reservoir...');
            const { data: dbFallback, error: dbError } = await supabase
                .from('message_library')
                .select('message_text')
                .eq('relationship', relationship)
                .eq('tone', tone)
                .limit(3);

            if (dbError) console.error("Database Lookup Error:", dbError);

            if (dbFallback && dbFallback.length > 0) {
                messages = dbFallback.map((m: { message_text: string }) => m.message_text);
                provider = 'safety-net';
                console.log("Safety Net Active: Serving 3 legacy messages");
            } else {
                console.log("Safety Net EMPTY for this criteria, trying random fallback...");
                const { data: randomFallback } = await supabase
                    .from('message_library')
                    .select('message_text')
                    .limit(3);
                if (randomFallback) {
                    messages = randomFallback.map((m: { message_text: string }) => m.message_text);
                    provider = 'safety-net';
                }
            }
        }

        if (messages.length === 0) throw new Error('System Offline');

        // --- STEP 4: PERSISTENCE ---
        if (provider !== 'safety-net') {
            const templates = sanitizeToTemplate(messages, recipient, sender);
            await supabase.from('message_library').insert(
                templates.map(txt => ({ relationship, tone, message_text: txt, provider }))
            );
            await supabase.from('ai_usage_logs').insert({
                model_name: provider.includes('gemini') ? 'gemini' : 'groq', status: 'success'
            });
            messages = personalizeMessages(templates, recipient, sender);
        } else {
            await supabase.from('ai_usage_logs').insert({
                model_name: 'safety-net', status: 'success'
            });
            messages = personalizeMessages(messages, recipient, sender);
        }

        return new Response(JSON.stringify({ messages, provider }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
