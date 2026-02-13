import * as React from 'react';
import { useState, useRef, useMemo, useEffect } from 'react';
import { Relationship, Tone, AppState } from './types';
import { RELATIONSHIP_OPTIONS, TONE_OPTIONS } from './constants';
import { generateValentineMessages } from './services/ai-gateway';
import ValentineCardTemplate from './components/ValentineCardTemplate';
import CupidPulse from './components/CupidPulse';
import { ChevronRight, ChevronLeft, Heart, Share2, MessageCircle, Download, RefreshCcw, AlertCircle, Sparkles, Check } from 'lucide-react';
import { ImageProcessError } from './error-classes';
import { toPng } from 'html-to-image';

import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import ReactGA from "react-ga4";

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    step: 0, // Start with Splash Screen
    relationship: null,
    recipientName: '',
    senderName: '',
    tone: null,
    generatedMessages: [],
    selectedMessageIndex: null,
    isLoading: false,
    error: null,
  });

  const [splashProgress, setSplashProgress] = useState(0);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Splash Screen Logic
  useEffect(() => {
    if (state.step === 0) {
      const interval = setInterval(() => {
        setSplashProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setState(s => ({ ...s, step: 1 })), 500);
            return 100;
          }
          return Math.min(prev + Math.random() * 10, 100);
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [state.step]);

  // Initialize Google Analytics
  useEffect(() => {
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (gaId && gaId !== 'YOUR_GA_MEASUREMENT_ID_HERE') {
      ReactGA.initialize(gaId);
    }
  }, []);

  // Track page views on step change
  useEffect(() => {
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (gaId && gaId !== 'YOUR_GA_MEASUREMENT_ID_HERE') {
      ReactGA.send({ hitType: "pageview", page: `/step-${state.step}`, title: `Step ${state.step}` });
    }
  }, [state.step]);

  const isWhatsappValid = useMemo(() => {
    return /^\+?[0-9]{5,15}$/.test(whatsappNumber.replace(/\s/g, ''));
  }, [whatsappNumber]);

  const nextStep = () => setState(prev => ({ ...prev, step: prev.step + 1, error: null }));
  const prevStep = () => setState(prev => ({ ...prev, step: prev.step - 1, error: null }));

  const handleGenerate = async () => {
    if (!state.relationship || !state.tone || !state.recipientName || !state.senderName) return;

    setState(prev => ({ ...prev, isLoading: true, step: 4, error: null }));

    try {
      const generated = await generateValentineMessages(
        state.recipientName,
        state.senderName,
        state.relationship,
        state.tone
      );

      // Simulate loading for better UX
      await new Promise(resolve => setTimeout(resolve, 2500));

      setState(prev => ({
        ...prev,
        generatedMessages: generated,
        step: 5,
        isLoading: false,
        selectedMessageIndex: 0
      }));
    } catch (err: any) {
      console.error(err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || "Cupid's ink ran dry! We couldn't generate your options. Please try again.",
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
      if (!cardRef.current) throw new ImageProcessError("Card preview not found.");
      const dataUrl = await toPng(cardRef.current, { quality: 0.95, pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'lovemessage.png', { type: 'image/png' });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'A Valentine Message',
          text: currentMessage
        });
      } else {
        const link = document.createElement('a');
        link.download = 'love-card.png';
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Sharing/Download failed:', err);
      alert("Could not share or download the image. Please try copying the text instead.");
    }
  };

  const handleDownloadCard = async () => {
    try {
      const dataUrl = await generateImageData();
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `valentine - ${state.recipientName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handleSendWhatsApp = () => {
    if (!currentMessage || !isWhatsappValid) return;
    let cleanNumber = whatsappNumber.replace(/\D/g, '');

    // Auto-prepend Nigerian country code (234) for common local formats
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '234' + cleanNumber.substring(1);
    } else if (cleanNumber.length === 10 || (cleanNumber.length === 11 && !cleanNumber.startsWith('234'))) {
      if (!cleanNumber.startsWith('234')) {
        cleanNumber = '234' + (cleanNumber.length === 11 ? cleanNumber.substring(1) : cleanNumber);
      }
    }

    const appLink = `\n\nCreate your own Valentine at: https://bit.ly/luvvapp`;
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
    <div className="h-[100dvh] w-screen flex flex-col items-center justify-between bg-[#FFC0CB] relative overflow-hidden font-sans pt-[env(safe-area-inset-top,20px)] pb-[env(safe-area-inset-bottom,24px)] px-4">
      <SpeedInsights />
      <Analytics />

      {/* Branding Header */}
      <div className="absolute top-6 left-0 right-0 z-20 flex justify-center items-center pointer-events-none">
        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-xl px-6 py-3 rounded-full border border-white/40 shadow-xl">
          <span className="text-crimson-800/80 font-serif italic text-lg">Made with</span>
          <img src="/logo.png" alt="Luvv Logo" className="h-10 w-auto" />
        </div>
      </div>

      {/* Main Container */}
      <div className={`w-full ${state.step >= 5 ? 'max-w-2xl' : 'max-w-[340px] md:max-w-2xl lg:max-w-4xl'} h-[70vh] md:h-[80vh] max-h-[850px] bg-[#8B0000] border-4 border-white/20 rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.4)] relative z-10 overflow-hidden flex flex-col transition-all duration-700 mt-16`}>

        {/* Progress Navigation */}
        <div className="flex w-full h-1.5 bg-rose-100/50">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div
              key={s}
              className={`flex-1 transition-colors duration-500 ${state.step >= s ? 'bg-[#8B0000]' : 'bg-[#FFC0CB]'}`}
            />
          ))}
        </div>

        <div className="p-8 md:p-10 flex-1 flex flex-col overflow-y-auto no-scrollbar">
          {state.step === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-12">
              <div className="relative">
                <div className="animate-bounce h-32 w-32 filter drop-shadow-[0_0_30px_rgba(255,77,109,0.4)]">
                  <Heart size={128} fill="#FF4D6D" stroke="#FF4D6D" className="text-[#FF4D6D]" />
                </div>
                {/* Secondary heart pulse */}
                <div className="absolute inset-0 animate-ping opacity-20">
                  <Heart size={128} fill="#FF4D6D" stroke="#FF4D6D" className="text-[#FF4D6D]" />
                </div>
              </div>

              <div className="text-center space-y-6 w-full max-w-[280px]">
                <h1 className="text-5xl font-serif font-bold text-white italic tracking-wider animate-pulse">
                  Spread Luvv
                </h1>

                <div className="space-y-3">
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-pink-400 to-[#FF4D6D] transition-all duration-300 ease-out"
                      style={{ width: `${splashProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.5em] opacity-40">
                    Preparing valid hearts...
                  </p>
                </div>
              </div>
            </div>
          )}

          {state.step === 1 && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-6 hover:scale-105 transition-transform duration-300">
                  <div className="p-8 bg-gradient-to-br from-pink-500 to-crimson-600 rounded-[2.5rem] shadow-2xl shadow-pink-500/20 ring-4 ring-white/10">
                    <Heart className="text-white" fill="white" size={64} />
                  </div>
                </div>
                <h1 className="text-4xl font-serif font-bold text-white mb-2">Who's the lucky one?</h1>
                <p className="text-pink-100/40 text-sm">Select your connection.</p>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 overflow-y-auto max-h-[380px] no-scrollbar px-4 pb-4 pt-2">
                {RELATIONSHIP_OPTIONS.map((opt) => {
                  const isSelected = state.relationship === opt.label;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => { setState(prev => ({ ...prev, relationship: opt.label })); }}
                      className={`flex flex-col items-center justify-center p-3 rounded-3xl transition-all aspect-square border-2 group active:scale-95 ${isSelected
                        ? 'bg-[#FF4D6D] border-white/40 shadow-[0_0_20px_rgba(255,77,109,0.4)] text-white scale-105'
                        : 'bg-white/5 border-white/5 text-pink-100/40 hover:border-white/20'}`}
                    >
                      <div className="mb-2 transition-transform group-hover:scale-110">{opt.icon}</div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8">
                <button
                  disabled={!state.relationship}
                  onClick={nextStep}
                  className={`w-full flex items-center justify-center gap-2 text-white py-5 rounded-full font-bold shadow-xl transition-all uppercase tracking-widest text-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:bg-[#3D0000] ${state.relationship ? 'bg-[#FF4D6D] shadow-[0_0_30px_rgba(255,77,109,0.8)] scale-105 hover:scale-110 hover:shadow-[0_0_40px_rgba(255,77,109,1)]' : ''}`}
                >
                  Continue <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {state.step === 2 && (
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-center mb-10">
                <h1 className="text-4xl font-serif font-bold text-white mb-2 italic">Personalize It</h1>
                <p className="text-pink-200/40 text-sm">Every heart has a name.</p>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.3em] px-2 block">To</label>
                  <input type="text" placeholder="Recipient's Name" value={state.recipientName} onChange={(e) => setState(prev => ({ ...prev, recipientName: e.target.value }))} className="w-full px-6 py-5 rounded-[2rem] bg-white/5 border-2 border-white/10 focus:border-pink-500/50 text-white placeholder-pink-200/20 shadow-sm transition-all outline-none font-serif text-lg italic" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.3em] px-2 block">From</label>
                  <input type="text" placeholder="Your Name" value={state.senderName} onChange={(e) => setState(prev => ({ ...prev, senderName: e.target.value }))} className="w-full px-6 py-5 rounded-[2rem] bg-white/5 border-2 border-white/10 focus:border-pink-500/50 text-white placeholder-pink-200/20 shadow-sm transition-all outline-none font-serif text-lg italic" />
                </div>
              </div>
              <div className="mt-12 flex gap-4">
                <button onClick={prevStep} className="p-5 rounded-full bg-white/5 text-pink-200 shadow-md hover:bg-white/10 active:scale-95 transition-all border border-white/10"><ChevronLeft size={24} /></button>
                <button
                  disabled={!state.recipientName || !state.senderName}
                  onClick={nextStep}
                  className={`flex-1 flex items-center justify-center gap-2 text-white py-5 rounded-full font-bold transition-all active:scale-95 uppercase tracking-widest text-sm disabled:bg-[#5A0000] disabled:opacity-40 ${state.recipientName && state.senderName ? 'bg-[#FF4D6D] shadow-[0_0_30px_rgba(255,77,109,0.6)] opacity-100' : ''}`}
                >
                  Continue <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {state.step === 3 && (
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-center mb-10">
                <h1 className="text-3xl font-serif font-bold text-[#8B0000] mb-2 italic">Set the Vibe</h1>
                <p className="text-gray-500 text-sm">Choose a tone to proceed.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
                {TONE_OPTIONS.map((t) => {
                  const isSelected = state.tone === t;
                  let selectedClasses = 'bg-white/5 shadow-none border-white/10';

                  if (isSelected) {
                    if (t === 'Romantic') selectedClasses = 'bg-[#FF0000] shadow-[0_0_20px_rgba(255,0,0,0.6)] border-white/40';
                    else if (t === 'Professional') selectedClasses = 'bg-[#4A4A4A] shadow-[0_0_20px_rgba(128,128,128,0.4)] border-white/40';
                    else selectedClasses = 'bg-[#FF4D6D] shadow-[0_0_20px_rgba(255,77,109,0.4)] border-white/40';
                  }

                  return (
                    <button
                      key={t}
                      onClick={() => setState(prev => ({ ...prev, tone: t }))}
                      className={`px-6 py-3 rounded-full border-2 transition-all font-bold tracking-wide text-white text-[11px] min-w-[100px] hover:scale-105 active:scale-95 ${selectedClasses}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="mt-14 flex gap-4">
                <button onClick={prevStep} className="p-5 rounded-full bg-white/5 text-pink-200 shadow-md hover:bg-white/10 active:scale-95 transition-all border border-white/10"><ChevronLeft size={24} /></button>
                <button
                  disabled={!state.tone}
                  onClick={handleGenerate}
                  className={`flex-1 flex items-center justify-center gap-2 text-white py-5 rounded-full font-bold transition-all active:scale-95 uppercase tracking-widest text-sm disabled:bg-[#3D0000] disabled:opacity-30 ${state.tone ? 'bg-[#FF4D6D] shadow-[0_0_30px_rgba(255,77,109,0.6)]' : ''}`}
                >
                  Create Magic <Sparkles size={20} />
                </button>
              </div>
            </div>
          )}

          {state.step === 4 && (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
              {state.error ? (
                <div className="text-center max-w-sm space-y-6">
                  <AlertCircle size={64} className="text-red-400 mx-auto" />
                  <div className="space-y-2">
                    <h2 className="text-2xl font-serif font-bold text-red-200 italic">Something went wrong</h2>
                    <p className="text-pink-100/60">{state.error}</p>
                  </div>
                  <button onClick={() => setState(prev => ({ ...prev, step: 3, error: null }))} className="flex items-center justify-center gap-2 mx-auto bg-white/5 border border-white/10 text-white px-8 py-4 rounded-full font-bold shadow-md hover:bg-white/10 transition-all uppercase tracking-widest text-xs">
                    <RefreshCcw size={16} /> Back to Tones
                  </button>
                </div>
              ) : (
                <CupidPulse />
              )}
            </div>
          )}

          {state.step === 5 && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-serif font-bold text-white mb-2 italic">Pick Your Favorite</h1>
                <p className="text-pink-100/40 text-sm">Swipe through these heartfelt options.</p>
              </div>

              <div className="relative h-[380px] w-full flex items-center justify-center overflow-hidden no-scrollbar">
                {state.generatedMessages.map((msg, idx) => {
                  const isSelected = state.selectedMessageIndex === idx;
                  if (!isSelected) return null; // Simple view for static: only show selected or create list

                  // For static version with "swipe" feel removed, let's show a list or just arrows
                  // But to keep UI similar, let's just show the selected one with arrows if we had them, 
                  // or just list them. A carousel without animation is tricky.
                  // Let's layout them out as a grid or list instead for better static UX? 
                  // User said "remove all animations", not "change layout". 
                  // But stacked cards rely on animation. Let's make it a list selection.
                })}

                {/* Re-implementing as a vertical list for better static UX or a simple carousel with next/prev buttons if needed. 
                    Given the "swipe" instruction, a list is safer for static. */}
                <div className="flex flex-col gap-4 w-full h-full overflow-y-auto no-scrollbar">
                  {state.generatedMessages.map((msg, idx) => {
                    const isSelected = state.selectedMessageIndex === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setState(prev => ({ ...prev, selectedMessageIndex: idx }))}
                        className={`w-full p-6 rounded-[2rem] border-2 transition-all cursor-pointer text-center relative ${isSelected
                          ? 'bg-gradient-to-br from-pink-600 to-crimson-700 border-pink-400 text-white shadow-lg'
                          : 'bg-white/5 border-white/10 text-pink-100/60 hover:bg-white/10'
                          }`}
                      >
                        {isSelected && (
                          <div className="absolute top-4 right-4 bg-green-500 text-white rounded-full p-1 shadow-lg">
                            <Check size={16} strokeWidth={4} />
                          </div>
                        )}
                        <p className="font-serif italic text-lg leading-relaxed">"{msg}"</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button onClick={() => setState(prev => ({ ...prev, step: 3 }))} className="p-5 rounded-full bg-white/5 text-pink-200 border border-white/10 hover:bg-white/10 transition-all"><ChevronLeft size={24} /></button>
                <button
                  disabled={state.selectedMessageIndex === null}
                  onClick={nextStep}
                  className={`flex-1 flex items-center justify-center gap-2 py-5 rounded-full font-bold transition-all uppercase tracking-widest text-sm active:scale-95 text-white disabled:bg-[#3D0000] disabled:opacity-30 ${state.selectedMessageIndex !== null ? 'bg-[#FF4D6D] shadow-[0_0_40px_rgba(255,77,109,0.8)]' : ''}`}
                >
                  Confirm Selection <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {state.step === 6 && (
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col items-center max-w-lg">
                <div className="text-center mb-8">
                  <span className="text-[10px] font-bold text-pink-400 uppercase tracking-[0.4em]">Your Final Masterpiece</span>
                </div>

                <div className="w-full aspect-[9/16] overflow-hidden rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative border-8 border-white/10 group bg-black">
                  <div className="absolute inset-0 scale-[0.38] md:scale-[0.45] origin-top-left xl:scale-[0.5]" style={{ width: '1080px', height: '1920px' }}>
                    <ValentineCardTemplate
                      message={currentMessage}
                      recipient={state.recipientName}
                      sender={state.senderName}
                      isPreview={true}
                    />
                  </div>
                </div>

                <div className="w-full mt-10 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-2">
                        <MessageCircle size={14} className="text-[#25D366]" />
                        <span className="text-[10px] font-bold text-pink-100/40 uppercase tracking-widest">Send directly via WhatsApp</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input type="tel" placeholder="08123456789" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)}
                            className={`w-full px-6 py-5 rounded-[2rem] bg-white/5 text-pink-100 outline-none transition-all text-sm border ${whatsappNumber && !isWhatsappValid ? 'border-red-500' : 'border-white/10 focus:border-pink-500/50'}`} />
                          {whatsappNumber && !isWhatsappValid && (
                            <span className="absolute -bottom-5 left-4 text-[8px] text-red-400 font-bold uppercase tracking-widest">Invalid number</span>
                          )}
                        </div>
                        <button
                          disabled={!isWhatsappValid}
                          onClick={handleSendWhatsApp}
                          className="bg-[#25D366] text-white px-8 rounded-[2rem] shadow-2xl shadow-[#25D366]/20 transition-all disabled:opacity-20 hover:scale-105 active:scale-95"
                        >
                          <ChevronRight size={24} />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button onClick={() => setState(prev => ({ ...prev, step: 5 }))} className="p-5 rounded-full bg-white/5 text-pink-200 border border-white/10 hover:bg-white/10 transition-all"><ChevronLeft size={24} /></button>
                      <div className="flex-1 flex flex-col sm:grid sm:grid-cols-2 gap-4">
                        <button
                          onClick={handleShareCard}
                          className="flex items-center justify-center gap-2 bg-pink-500 text-white py-5 rounded-[2rem] font-bold shadow-2xl shadow-pink-500/20 transition-all text-sm uppercase tracking-widest hover:scale-105 active:scale-95"
                        >
                          <Share2 size={18} /> Share
                        </button>
                        <button
                          onClick={handleDownloadCard}
                          className="flex items-center justify-center gap-2 bg-white/5 text-white py-5 rounded-[2rem] font-bold border border-white/10 transition-all text-xs sm:text-sm uppercase tracking-widest hover:scale-105 active:scale-95"
                        >
                          <Download size={18} /> Download
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => setState(prev => ({ ...prev, step: 1, generatedMessages: [], selectedMessageIndex: null, relationship: null, tone: null, recipientName: '', senderName: '' }))}
                      className="w-full text-pink-100/20 py-4 font-bold text-[10px] uppercase tracking-[0.5em] hover:text-white transition-all"
                    >
                      Start New Craft
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-20 flex justify-center items-center mt-4">
        <div
          className="flex flex-col items-center gap-1 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 shadow-lg text-center hover:scale-105 transition-transform"
        >
          <span className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">designed by @jesprecstudios</span>
          <span className="text-white text-[10px] font-bold uppercase tracking-[0.3em]">&copy; 2026 LUVV APP</span>
        </div>
      </footer>

      <div className="fixed -left-[4000px] top-0 pointer-events-none">
        {state.selectedMessageIndex !== null && (
          <ValentineCardTemplate ref={cardRef} message={currentMessage} recipient={state.recipientName} sender={state.senderName} />
        )}
      </div>
    </div>
  );
};

export default App;
