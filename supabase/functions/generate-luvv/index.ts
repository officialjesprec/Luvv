import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ... (Keep your normalize, sanitize, and personalize helper functions the same) ...

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { recipient, sender, relationship, tone } = await req.json();
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const prompt = `Write a deep, heartfelt ${tone} Valentine's message for my ${relationship}. 
        Use placeholders [RECIPIENT] and [SENDER]. Return JSON with key "messages" containing 3 options.`;

        let messages: string[] = [];
        let provider = '';

        // --- STEP 1: TRY GEMINI (AI-FIRST) ---
        try {
            console.log('Attempting Gemini...');
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
                if (rawText) {
                    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
                    messages = normalizeMessages(parsed.messages);
                    provider = 'gemini-2.5-flash';
                }
            }
        } catch (e) { console.error('Gemini Failed'); }

        // --- STEP 2: TRY GROQ (IF GEMINI FAILED) ---
        if (messages.length === 0) {
            try {
                console.log('Gemini failed. Attempting Groq...');
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
                    const parsed = JSON.parse(data.choices[0].message.content);
                    messages = normalizeMessages(parsed.messages);
                    provider = 'groq-llama-3.1';
                }
            } catch (e) { console.error('Groq Failed'); }
        }

        // --- STEP 3: CONSULT DATABASE (ONLY IF BOTH AI FAILED) ---
        if (messages.length === 0) {
            console.log('AI models unavailable. Consulting Database Backup...');
            const { data: dbFallback } = await supabase
                .from('message_library')
                .select('message_text')
                .eq('relationship', relationship)
                .eq('tone', tone)
                .order('created_at', { ascending: false }) // Get the most recent ones
                .limit(3);

            if (dbFallback && dbFallback.length > 0) {
                messages = dbFallback.map(m => m.message_text);
                provider = 'db-safety-net';
            }
        }

        if (messages.length === 0) throw new Error('Complete System Failure');

        // --- STEP 4: BACKUP NEW MESSAGES TO DB ---
        if (provider.includes('gemini') || provider.includes('groq')) {
            const templateMessages = sanitizeToTemplate(messages, recipient, sender);
            const dbEntries = templateMessages.map(txt => ({
                relationship, tone, message_text: txt, provider
            }));
            await supabase.from('message_library').insert(dbEntries);
            // Log for your dashboard
            await supabase.from('ai_usage_logs').insert({ 
                model_name: provider.includes('gemini') ? 'gemini' : 'groq', status: 'success' 
            });
        }

        // Always personalize for the user
        const finalMessages = personalizeMessages(messages, recipient, sender);
        return new Response(JSON.stringify({ messages: finalMessages, provider }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
