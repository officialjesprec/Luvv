import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-[#FFC0CB] flex items-center justify-center p-8 text-center">
                    <div className="max-w-md w-full bg-[#8B0000] p-10 rounded-[3rem] border border-white/20 shadow-2xl space-y-6">
                        <div className="flex justify-center">
                            <div className="p-6 bg-white/10 rounded-full">
                                <AlertCircle size={64} className="text-white" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-serif font-bold text-white italic">Something tripped up</h1>
                            <p className="text-pink-200/60 text-sm">The magic hit a snag. Let's try again.</p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full flex items-center justify-center gap-2 bg-pink-500 text-white py-5 rounded-full font-bold shadow-lg hover:shadow-pink-500/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
                        >
                            <RefreshCcw size={16} /> Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
