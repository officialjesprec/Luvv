
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  Heart, 
  Share2, 
  MessageCircle,
  Sparkles,
  Copy,
  Check,
  RefreshCcw,
  AlertCircle,
  Download
} from 'lucide-react';
import { toPng } from 'html-to-image';

import { Relationship, Tone, AppState } from './types';
import { RELATIONSHIP_OPTIONS, TONE_OPTIONS } from './constants';
import { generateValentineMessages } from './services/gemini';
import ValentineCardTemplate from './components/ValentineCardTemplate';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    step: 1,
    relationship: null,
    recipientName: '',
    senderName: '',
    tone: null,
    generatedMessages: [],
    selectedMessageIndex: null,
    isLoading: false,
    error: null,
  });

  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isWhatsappValid = useMemo(() => {
    return /^\+?[0-9]{5,15}$/.test(whatsappNumber.replace(/\s/g, ''));
  }, [whatsappNumber]);

  const nextStep = () => setState(prev => ({ ...prev, step: prev.step + 1, error: null }));
  const prevStep = () => setState(prev => ({ ...prev, step: prev.step - 1, error: null }));

  const handleGenerate = async () => {
    if (!state.relationship || !state.tone || !state.recipientName || !state.senderName) return;
    
    setState(prev => ({ ...prev, isLoading: true, step: 4, error: null }));
    
    try {
      const messages = await generateValentineMessages(
        state.recipientName,
        state.senderName,
        state.relationship,
        state.tone
      );
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      setState(prev => ({ 
        ...prev, 
        generatedMessages: messages, 
        selectedMessageIndex: null,
        isLoading: false, 
        step: 5 
      }));
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Cupid's ink ran dry! We couldn't generate your options. Please try again.",
        step: 4 
      }));
    }
  };

  const currentMessage = state.selectedMessageIndex !== null 
    ? state.generatedMessages[state.selectedMessageIndex] 
    : '';

  const generateImageData = async () => {
    if (!cardRef.current) return null;
    return await toPng(cardRef.current, { 
      cacheBust: true,
      width: 1080,
      height: 1920,
      pixelRatio: 2
    });
  };

  const handleShareCard = async () => {
    try {
      const dataUrl = await generateImageData();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `valentine-${state.recipientName}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'A Valentine for you!',
          text: `I made this special card just for you ❤️. Create yours here: ${window.location.origin}`,
        });
      } else {
        handleDownloadCard();
      }
    } catch (err) {
      handleDownloadCard();
    }
  };

  const handleDownloadCard = async () => {
    try {
      const dataUrl = await generateImageData();
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `valentine-${state.recipientName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handleSendWhatsApp = () => {
    if (!currentMessage || !isWhatsappValid) return;
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const appLink = `\n\nMade with ❤️ at ${window.location.origin}`;
    const fullText = currentMessage + appLink;
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(fullText)}`;
    window.open(url, '_blank');
  };

  const copyToClipboard = () => {
    if (currentMessage) {
      navigator.clipboard.writeText(currentMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#FFFDD0] relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: '110vh', x: `${Math.random() * 100}vw`, opacity: 0.1, scale: Math.random() }}
            animate={{ y: '-10vh' }}
            transition={{ 
              duration: 15 + Math.random() * 25, 
              repeat: Infinity, 
              delay: Math.random() * 20,
              ease: "linear"
            }}
            className="absolute text-[#8B0000]"
          >
            <Heart size={20 + Math.random() * 60} fill="currentColor" />
          </motion.div>
        ))}
      </div>

      {/* Main Container */}
      <div className={`w-full ${state.step >= 5 ? 'max-w-4xl' : 'max-w-md'} bg-white/60 backdrop-blur-2xl border border-white/50 rounded-[3rem] shadow-[0_20px_50px_rgba(139,0,0,0.1)] relative z-10 overflow-hidden flex flex-col transition-all duration-500`}>
        
        {/* Progress Navigation */}
        <div className="flex w-full h-1.5 bg-rose-100/50">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <motion.div 
              key={s} 
              initial={false}
              animate={{ backgroundColor: state.step >= s ? '#8B0000' : '#FFC0CB' }}
              className="flex-1 transition-colors duration-500" 
            />
          ))}
        </div>

        <div className="p-6 md:p-10 flex-1 flex flex-col min-h-[520px]">
          <AnimatePresence mode="wait">
            {state.step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex-1 flex flex-col">
                <div className="text-center mb-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex justify-center mb-4">
                    <Heart className="text-[#8B0000] animate-pulse" fill="#8B0000" size={32} />
                  </motion.div>
                  <h1 className="text-3xl font-serif font-bold text-[#8B0000] mb-2">Who is this for?</h1>
                  <p className="text-gray-500 text-sm">Select a relationship to light up the path.</p>
                </div>
                <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[380px] no-scrollbar pr-1 pb-4">
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <button key={opt.label} onClick={() => { setState(prev => ({ ...prev, relationship: opt.label })); }}
                      className={`flex flex-col items-center justify-center p-3 rounded-3xl transition-all aspect-square border-2 group ${state.relationship === opt.label ? 'bg-[#8B0000] border-[#8B0000] text-[#FFFDD0] shadow-xl scale-95' : 'bg-white/40 border-white text-[#8B0000] hover:border-rose-200 hover:bg-white/80'}`}>
                      <div className="mb-2 transition-transform group-hover:scale-110">{opt.icon}</div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-8">
                   <button 
                    disabled={!state.relationship} 
                    onClick={nextStep} 
                    className="w-full flex items-center justify-center gap-2 bg-[#8B0000] text-[#FFFDD0] py-5 rounded-full font-bold shadow-xl hover:bg-[#6b0000] transition-all disabled:opacity-30 active:scale-95 uppercase tracking-widest text-sm"
                  >
                    Continue <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {state.step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex-1 flex flex-col justify-center">
                <div className="text-center mb-10">
                  <h1 className="text-3xl font-serif font-bold text-[#8B0000] mb-2 italic">Personalize It</h1>
                  <p className="text-gray-500 text-sm">Every heart has a name.</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#8B0000] uppercase tracking-[0.3em] px-2 block">To</label>
                    <input type="text" placeholder="Recipient's Name" value={state.recipientName} onChange={(e) => setState(prev => ({ ...prev, recipientName: e.target.value }))} className="w-full px-6 py-5 rounded-[2rem] bg-white border-2 border-transparent focus:border-[#8B0000] shadow-sm transition-all outline-none font-serif text-lg italic" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#8B0000] uppercase tracking-[0.3em] px-2 block">From</label>
                    <input type="text" placeholder="Your Name" value={state.senderName} onChange={(e) => setState(prev => ({ ...prev, senderName: e.target.value }))} className="w-full px-6 py-5 rounded-[2rem] bg-white border-2 border-transparent focus:border-[#8B0000] shadow-sm transition-all outline-none font-serif text-lg italic" />
                  </div>
                </div>
                <div className="mt-12 flex gap-4">
                  <button onClick={prevStep} className="p-5 rounded-full bg-white text-[#8B0000] shadow-md hover:scale-105 active:scale-95 transition-all border border-rose-100"><ChevronLeft size={24} /></button>
                  <button disabled={!state.recipientName.trim() || !state.senderName.trim()} onClick={nextStep} className="flex-1 flex items-center justify-center gap-2 bg-[#8B0000] text-[#FFFDD0] py-5 rounded-full font-bold shadow-xl hover:bg-[#6b0000] transition-all disabled:opacity-30 active:scale-95 uppercase tracking-widest text-sm">Continue <ChevronRight size={20} /></button>
                </div>
              </motion.div>
            )}

            {state.step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex-1 flex flex-col justify-center">
                <div className="text-center mb-10">
                  <h1 className="text-3xl font-serif font-bold text-[#8B0000] mb-2 italic">Set the Vibe</h1>
                  <p className="text-gray-500 text-sm">Choose a tone to proceed.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {TONE_OPTIONS.map((t) => (
                    <button key={t} onClick={() => setState(prev => ({ ...prev, tone: t }))} className={`px-8 py-4 rounded-full border-2 transition-all font-bold tracking-wide ${state.tone === t ? 'bg-[#8B0000] border-[#8B0000] text-[#FFFDD0] scale-105 shadow-lg' : 'bg-white border-rose-50 text-[#8B0000] hover:bg-rose-50 hover:border-rose-200'}`}>{t}</button>
                  ))}
                </div>
                <div className="mt-14 flex gap-4">
                  <button onClick={prevStep} className="p-5 rounded-full bg-white text-[#8B0000] shadow-md hover:scale-105 active:scale-95 transition-all border border-rose-100"><ChevronLeft size={24} /></button>
                  <button disabled={!state.tone} onClick={handleGenerate} className="flex-1 flex items-center justify-center gap-2 bg-[#8B0000] text-[#FFFDD0] py-5 rounded-full font-bold shadow-xl hover:bg-[#6b0000] transition-all disabled:opacity-30 active:scale-95 uppercase tracking-widest text-sm">Create Magic <Sparkles size={20} /></button>
                </div>
              </motion.div>
            )}

            {state.step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                {state.error ? (
                  <div className="text-center max-w-sm space-y-6">
                    <AlertCircle size={64} className="text-red-500 mx-auto" />
                    <div className="space-y-2">
                      <h2 className="text-2xl font-serif font-bold text-red-700 italic">Something went wrong</h2>
                      <p className="text-gray-600">{state.error}</p>
                    </div>
                    <button onClick={() => setState(prev => ({ ...prev, step: 3, error: null }))} className="flex items-center justify-center gap-2 mx-auto bg-white border border-red-200 text-red-700 px-8 py-4 rounded-full font-bold shadow-md hover:bg-red-50 transition-all uppercase tracking-widest text-xs">
                      <RefreshCcw size={16} /> Back to Tones
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-8">
                      <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-[#8B0000]"><Heart size={100} fill="currentColor" /></motion.div>
                      <motion.div animate={{ y: [-20, 20], opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="absolute inset-0 flex items-center justify-center text-rose-200"><Sparkles size={40} /></motion.div>
                    </div>
                    <div className="text-center space-y-2">
                      <h2 className="text-3xl font-serif font-bold text-[#8B0000] italic">Cupid is writing...</h2>
                      <p className="text-gray-400 font-medium tracking-wide uppercase text-[10px] animate-pulse">Crafting three perfect options for you</p>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {state.step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex-1 flex flex-col">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-serif font-bold text-[#8B0000] mb-2 italic">Pick Your Favorite</h1>
                  <p className="text-gray-500 text-sm">Swipe to explore three unique options.</p>
                </div>

                <div 
                  ref={scrollContainerRef}
                  className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory py-4 px-2"
                >
                  {state.generatedMessages.map((msg, idx) => (
                    <motion.div 
                      key={idx}
                      onClick={() => setState(prev => ({ ...prev, selectedMessageIndex: idx }))}
                      className={`relative min-w-[80%] md:min-w-[300px] snap-center p-8 rounded-[2.5rem] border-4 transition-all cursor-pointer flex flex-col justify-center items-center text-center h-[300px] ${
                        state.selectedMessageIndex === idx 
                        ? 'bg-[#8B0000] border-[#8B0000] text-[#FFFDD0] shadow-2xl scale-105' 
                        : 'bg-white/80 border-white text-gray-800'
                      }`}
                    >
                      {state.selectedMessageIndex === idx && (
                        <div className="absolute top-4 right-4 bg-[#FFFDD0] text-[#8B0000] rounded-full p-1 shadow-md">
                          <Check size={16} strokeWidth={4} />
                        </div>
                      )}
                      <p className="font-serif italic text-lg leading-relaxed">"{msg}"</p>
                      <div className="mt-4 text-[10px] font-bold uppercase tracking-widest opacity-50">Option {idx + 1}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-12 flex gap-4">
                  <button onClick={prevStep} className="p-5 rounded-full bg-white text-[#8B0000] shadow-md hover:scale-105 active:scale-95 transition-all border border-rose-100">
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    disabled={state.selectedMessageIndex === null} 
                    onClick={nextStep} 
                    className={`flex-1 flex items-center justify-center gap-2 py-5 rounded-full font-bold shadow-xl transition-all uppercase tracking-widest text-sm active:scale-95 ${
                      state.selectedMessageIndex !== null 
                      ? 'bg-[#8B0000] text-[#FFFDD0] hover:bg-[#6b0000]' 
                      : 'bg-gray-200 text-gray-400 opacity-50'
                    }`}
                  >
                    Confirm Selection <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {state.step === 6 && (
              <motion.div key="step6" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-1/3 flex flex-col items-center">
                  <div className="text-center mb-4">
                    <span className="text-[10px] font-bold text-[#8B0000] uppercase tracking-[0.4em]">Final Result</span>
                  </div>
                  <div className="w-full aspect-[9/16] max-h-[400px] overflow-hidden rounded-[2rem] shadow-2xl relative border-4 border-white/50">
                    <div className="absolute inset-0 scale-[0.25] origin-top-left" style={{ width: '1080px', height: '1920px' }}>
                      <ValentineCardTemplate 
                        message={currentMessage} 
                        recipient={state.recipientName} 
                        sender={state.senderName} 
                        isPreview={true} 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-6">
                  <div className="relative bg-white/80 p-6 rounded-[2rem] border border-white shadow-inner flex flex-col">
                    <p className="font-serif italic text-lg md:text-xl text-gray-800 leading-relaxed text-center lg:text-left">
                      "{currentMessage}"
                    </p>
                    <div className="mt-4 flex justify-center lg:justify-start gap-3">
                      <button onClick={copyToClipboard} className="flex items-center gap-2 text-[#8B0000] text-[10px] font-bold uppercase tracking-widest bg-rose-50 px-4 py-2 rounded-full hover:bg-rose-100 transition-colors">
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        {isCopied ? 'Copied' : 'Copy Text'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-2">
                        <MessageCircle size={14} className="text-[#25D366]" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Send via WhatsApp</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input type="tel" placeholder="+1234567890" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} 
                            className={`w-full px-5 py-4 rounded-2xl bg-white outline-none transition-all text-sm border ${whatsappNumber && !isWhatsappValid ? 'border-red-500 ring-2 ring-red-100' : 'border-rose-50 focus:ring-2 ring-rose-100'}`} />
                          {whatsappNumber && !isWhatsappValid && (
                            <span className="absolute -bottom-5 left-2 text-[8px] text-red-500 font-bold uppercase tracking-widest">Invalid format</span>
                          )}
                        </div>
                        <button disabled={!isWhatsappValid} onClick={handleSendWhatsApp} className="bg-[#25D366] text-white px-6 rounded-2xl shadow-lg hover:shadow-[#25D366]/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50">
                          <ChevronRight size={24} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button onClick={handleShareCard} className="flex items-center justify-center gap-2 bg-[#8B0000] text-[#FFFDD0] py-4 rounded-2xl font-bold shadow-xl hover:shadow-[#8B0000]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm uppercase tracking-widest">
                        <Share2 size={18} /> Share Card
                      </button>
                      <button onClick={handleDownloadCard} className="flex items-center justify-center gap-2 bg-white text-[#8B0000] py-4 rounded-2xl font-bold border border-[#8B0000] hover:bg-rose-50 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm uppercase tracking-widest">
                        <Download size={18} /> Download Card
                      </button>
                    </div>
                    <button onClick={() => setState(prev => ({ ...prev, step: 1, generatedMessages: [], selectedMessageIndex: null }))} className="w-full flex items-center justify-center gap-2 bg-rose-50 text-[#8B0000] py-4 rounded-2xl font-bold border border-rose-100 hover:bg-rose-100 transition-all text-sm uppercase tracking-widest">
                      <RefreshCcw size={18} /> Start Over
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-8 text-center">
        <p className="text-[#8B0000] font-serif italic text-lg opacity-40">Created for moments that matter</p>
        <div className="mt-2 flex justify-center gap-4 text-[#8B0000] opacity-20">
          <Heart size={12} fill="currentColor" /><Heart size={12} fill="currentColor" /><Heart size={12} fill="currentColor" />
        </div>
      </motion.div>

      <div className="fixed -left-[4000px] top-0 pointer-events-none">
        {state.selectedMessageIndex !== null && (
          <ValentineCardTemplate ref={cardRef} message={currentMessage} recipient={state.recipientName} sender={state.senderName} />
        )}
      </div>
    </div>
  );
};

export default App;
