import React from 'react';
import { Home, BarChart, ExternalLink } from 'lucide-react';

const AdminDashboard: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-white mb-2">Luvv HQ</h1>
                        <p className="text-gray-400">Overview & Analytics</p>
                    </div>
                    <a href="/" className="flex items-center gap-2 px-6 py-3 bg-white/10 rounded-full hover:bg-white/20 transition-all text-sm font-bold">
                        <Home size={16} /> Open App
                    </a>
                </header>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {/* Analytics Cards */}
                    <div className="bg-gray-800 p-6 rounded-[2rem] border border-gray-700 hover:border-pink-500/50 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                                <BarChart size={24} />
                            </div>
                            <ExternalLink size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Google Analytics</h3>
                        <p className="text-gray-400 text-sm mb-6">Real-time user traffic and engagement reports.</p>
                        <a
                            href="https://analytics.google.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block w-full py-3 text-center bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors"
                        >
                            Open Report
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-[2rem] border border-gray-700 hover:border-white transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-black rounded-xl text-white">
                                <svg height="24" viewBox="0 0 116 100" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M57.5 0L115 100H0L57.5 0z" /></svg>
                            </div>
                            <ExternalLink size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Vercel Analytics</h3>
                        <p className="text-gray-400 text-sm mb-6">Server-side performance and web vitals.</p>
                        <a
                            href="https://vercel.com/dashboard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block w-full py-3 text-center bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors"
                        >
                            View Metrics
                        </a>
                    </div>
                </div>

                {/* Info Section */}
                <div className="bg-gray-800/50 p-8 rounded-[2rem] border border-gray-700/50">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        System Status
                    </h3>
                    <div className="space-y-4 text-sm text-gray-400">
                        <div className="flex justify-between py-3 border-b border-gray-700">
                            <span>Gemini API Status</span>
                            <span className="text-green-400 font-mono">OPERATIONAL</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-gray-700">
                            <span>Analytics Integration</span>
                            <span className="text-green-400 font-mono">ACTIVE</span>
                        </div>
                        <div className="flex justify-between py-3">
                            <span>Last Deployment</span>
                            <span className="text-white font-mono">{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <footer className="mt-12 text-center text-gray-600 text-xs uppercase tracking-widest">
                    Luvv Dashboard &bull; v1.0.3
                </footer>
            </div>
        </div>
    );
};

export default AdminDashboard;
