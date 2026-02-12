
import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

const CupidPulse: React.FC = () => {
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState("Thinking of you...");

    useEffect(() => {
        // Total duration approx 2.5s (matching the simulated delay in App.tsx)
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                // Increment by random amount to feel organic
                return Math.min(prev + Math.random() * 5, 100);
            });
        }, 100);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (progress < 30) {
            setMessage("Thinking of you...");
        } else if (progress < 70) {
            setMessage("Consulting Cupid...");
        } else {
            setMessage("Polishing the words...");
        }
    }, [progress]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
            <div className="relative mb-8">
                {/* Background Heart (Empty/Dim) */}
                <div className="text-pink-900/30">
                    <Heart size={100} fill="currentColor" strokeWidth={0} />
                </div>

                {/* Foreground Heart (Filling) */}
                <div
                    className="absolute bottom-0 left-0 w-full overflow-hidden transition-all duration-300 ease-out text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.6)]"
                    style={{ height: `${progress}%` }}
                >
                    <Heart size={100} fill="currentColor" strokeWidth={0} className="absolute bottom-0 left-0" />
                </div>

                {/* Outline Overlay */}
                <div className="absolute inset-0 text-pink-300/50">
                    <Heart size={100} strokeWidth={1.5} />
                </div>
            </div>

            <div className="text-center space-y-3">
                <h2 className="text-3xl font-serif font-bold text-white italic tracking-wide animate-pulse">
                    {Math.round(progress)}%
                </h2>
                <p className="text-pink-200 font-medium tracking-widest uppercase text-xs">
                    {message}
                </p>
            </div>

            {/* Progress Bar Line */}
            <div className="w-64 h-1 bg-pink-900/50 rounded-full mt-6 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-pink-500 to-crimson-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default CupidPulse;
