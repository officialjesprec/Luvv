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

        const prompt = `Write 3 deep, soulful ${tone} Valentine's love letters (around 150 words each) for my ${relationship}. 
        Use [RECIPIENT] and [SENDER] as placeholders. 
        IMPORTANT: Return ONLY a valid JSON object with the key "messages" containing an array of the 3 strings.`;

        let messages: string[] = [];
        let provider = '';

        // --- STEP 1: GEMINI 2.5 ---
        if (GEMINI_API_KEY) {
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
                    messages = extractMessages(rawText);
                    if (messages.length > 0) provider = 'gemini-2.5-flash';
                }
            } catch (e) { console.error('Gemini Failed'); }
        }

        // --- STEP 2: GROQ ---
        if (messages.length === 0 && GROQ_API_KEY) {
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
                    messages = extractMessages(data.choices[0].message.content);
                    if (messages.length > 0) provider = 'groq-llama-3.1';
                }
            } catch (e) { console.error('Groq Failed'); }
        }

        // --- STEP 3: DATABASE SAFETY NET ---
        if (messages.length === 0) {
            console.log('AI models unavailable. Consulting Database Backup...');
            const { data: dbFallback } = await supabase
                .from('message_library')
                .select('message_text')
                .eq('relationship', relationship)
                .eq('tone', tone)
                .limit(3);

            if (dbFallback && dbFallback.length > 0) {
                messages = dbFallback.map(m => m.message_text);
                provider = 'safety-net';
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
