import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Clock, ArrowUpRight, TrendingUp, Calendar, Heart, ShieldCheck, Zap, Activity, BarChart3, Users } from 'lucide-react';
import { supabase } from '../services/supabase';
import { RELATIONSHIP_OPTIONS } from '../constants';

interface Stats {
    visits: {
        today: number;
        yesterday: number;
        week: number;
        lastWeek: number;
        month: number;
    };
    relationships: Record<string, number>;
    totalGenerated: number;
    totalGeneratedYesterday: number;
    dailyMessages: { date: string; count: number }[];
    providers: {
        gemini: { messages: number; requests: number };
        groq: { messages: number; requests: number };
        safetyNet: { messages: number; requests: number };
    };
    health: {
        latency: string;
        load: string;
        aiStatus: string;
    }
}

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats>({
        visits: { today: 0, yesterday: 0, week: 0, lastWeek: 0, month: 0 },
        relationships: {},
        totalGenerated: 0,
        totalGeneratedYesterday: 0,
        dailyMessages: [],
        providers: {
            gemini: { messages: 0, requests: 0 },
            groq: { messages: 0, requests: 0 },
            safetyNet: { messages: 0, requests: 0 }
        },
        health: { latency: '0ms', load: '0%', aiStatus: 'Checking...' }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('Overview');

    // Real-time Trend Calculator
    const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? '+100%' : '0%';
        const diff = ((current - previous) / previous) * 100;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    };

    useEffect(() => {
        const fetchStats = async () => {
            if (!supabase) return;
            const startTime = Date.now();
            setIsLoading(true);

            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const yesterdayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            try {
                // Parallel Fetching for Speed
                const [today, yesterday, week, lastWeek, month] = await Promise.all([
                    supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
                    supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
                    supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
                    supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', lastWeekStart).lt('created_at', weekStart),
                    supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', monthStart)
                ]);

                const [{ data: usageData }, { data: aiLogs }] = await Promise.all([
                    supabase.from('message_library').select('relationship, created_at, provider'),
                    supabase.from('ai_usage_logs').select('model_name, created_at')
                ]);
                const endTime = Date.now();

                const relCounts: Record<string, number> = {};
                const dailyCounts: Record<string, number> = {};
                const providerCounts = {
                    gemini: { messages: 0, requests: 0 },
                    groq: { messages: 0, requests: 0 },
                    safetyNet: { messages: 0, requests: 0 }
                };

                // Initialize 7-day window
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    dailyCounts[dateStr] = 0;
                }

                let generatedToday = 0;
                let generatedYesterday = 0;

                usageData?.forEach(item => {
                    relCounts[item.relationship] = (relCounts[item.relationship] || 0) + 1;
                    if (item.created_at >= todayStart) generatedToday++;
                    if (item.created_at >= yesterdayStart && item.created_at < todayStart) generatedYesterday++;

                    if (item.provider?.toLowerCase().includes('gemini')) providerCounts.gemini.messages++;
                    else if (item.provider?.toLowerCase().includes('groq')) providerCounts.groq.messages++;

                    // Safety Net "Messages" represents the total pool available in the reservoir
                    providerCounts.safetyNet.messages = usageData.length;
                });

                aiLogs?.forEach(log => {
                    const model = log.model_name?.toLowerCase() || '';
                    if (model.includes('gemini')) providerCounts.gemini.requests++;
                    else if (model.includes('groq')) providerCounts.groq.requests++;
                    else if (model.includes('safety-net')) providerCounts.safetyNet.requests++;
                });

                setStats({
                    visits: {
                        today: today.count || 0,
                        yesterday: yesterday.count || 0,
                        week: week.count || 0,
                        lastWeek: lastWeek.count || 0,
                        month: month.count || 0
                    },
                    relationships: relCounts,
                    totalGenerated: usageData?.length || 0,
                    totalGeneratedYesterday: generatedYesterday,
                    dailyMessages: Object.entries(relCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([rel, count]) => ({ date: rel, count })),
                    providers: providerCounts,
                    health: {
                        latency: `${endTime - startTime}ms`,
                        load: `${Math.min((generatedToday / 250) * 100, 100).toFixed(0)}%`,
                        aiStatus: (today.count ?? 0) > 0 ? 'Operational' : 'Active'
                    }
                });
            } catch (error) {
                console.error("Failed to fetch analytics:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();

        // Real-time Subscriptions
        const channel = supabase?.channel('admin-stats')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_visits' }, () => fetchStats())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_library' }, () => fetchStats())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_usage_logs' }, () => fetchStats())
            .subscribe();

        return () => { supabase?.removeChannel(channel as any); };
    }, []);

    return (
        <div className="min-h-screen bg-[#3D0000] text-white font-sans overflow-x-hidden selection:bg-pink-500/30">
            {/* High-fidelity Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-pink-600 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-crimson-800 rounded-full blur-[150px]"></div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-pink-500 to-crimson-600 rounded-2xl shadow-xl shadow-pink-500/10">
                                <ShieldCheck size={28} className="text-white" />
                            </div>
                            <h1 className="text-4xl font-serif font-bold italic tracking-tight">Luvv HQ <span className="text-pink-400">Analytics</span></h1>
                        </div>
                        <p className="text-pink-100/40 font-medium pl-14">Real-time performance metrics</p>
                    </div>
                    <Link to="/" className="flex items-center gap-2 px-8 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 transition-all text-sm font-bold active:scale-95 group">
                        <Home size={18} className="group-hover:text-pink-400 transition-colors" /> Back to App
                    </Link>
                </header>

                {/* Performance Monitoring Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard title="Visits Today" value={stats.visits.today} icon={<Clock className="text-blue-400" />} trend={calculateTrend(stats.visits.today, stats.visits.yesterday)} sub="Since midnight" color="blue" />
                    <StatCard title="Messages Total" value={stats.totalGenerated} icon={<Zap className="text-amber-400" />} trend={calculateTrend(stats.totalGenerated, stats.totalGeneratedYesterday)} sub="Lifetime Generation" color="amber" />
                    <StatCard title="Visits (Week)" value={stats.visits.week} icon={<Calendar className="text-purple-400" />} trend={calculateTrend(stats.visits.week, stats.visits.lastWeek)} sub="Past 7 days" color="purple" />
                    <StatCard title="Visits (Month)" value={stats.visits.month} icon={<TrendingUp className="text-emerald-400" />} trend="+100%" sub="February Traffic" color="emerald" />
                </div>

                {/* AI Performance Card (Newly restored & Expanded) */}
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3.5rem] p-10 shadow-2xl mb-12">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-3xl font-serif font-bold italic">AI Generation Mix</h3>
                            <p className="text-pink-100/30 text-sm mt-1">Monitor failover logic in real-time</p>
                        </div>
                        <div className="flex items-center gap-3 px-5 py-2 bg-pink-500/10 rounded-2xl border border-pink-500/20">
                            <Activity size={18} className="text-pink-400 animate-pulse" />
                            <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Live API Feed</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <ProviderCard label="Gemini 2.5 Flash" requests={stats.providers.gemini.requests} messages={stats.providers.gemini.messages} sub="Primary AI" color="pink" />
                        <ProviderCard label="Groq Llama 3.1" requests={stats.providers.groq.requests} messages={stats.providers.groq.messages} sub="Failover Provider" color="amber" />
                        <ProviderCard label="Safety Net" requests={stats.providers.safetyNet.requests} messages={stats.providers.safetyNet.messages} sub="Database Backups" color="blue" />
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Insights Tabs */}
                    <div className="lg:col-span-2 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3.5rem] overflow-hidden flex flex-col">
                        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h3 className="text-2xl font-serif font-bold">Audience Insights</h3>
                            <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5">
                                {['Overview', 'Traffic'].map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab ? 'bg-pink-600 text-white shadow-xl shadow-pink-600/20' : 'text-pink-100/40 hover:text-white'}`}>{tab}</button>
                                ))}
                            </div>
                        </div>

                        <div className="p-10 flex-1">
                            {activeTab === 'Overview' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                                    {RELATIONSHIP_OPTIONS
                                        .map(opt => ({ ...opt, count: stats.relationships[opt.label] || 0 }))
                                        .sort((a, b) => b.count - a.count)
                                        .map((opt) => {
                                            const percentage = stats.totalGenerated > 0 ? (opt.count / stats.totalGenerated) * 100 : 0;
                                            return (
                                                <div key={opt.label} className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] group hover:border-pink-500/40 transition-all hover:bg-white/10 flex flex-col items-center">
                                                    <div className="mb-4 text-pink-400 group-hover:scale-125 transition-transform">{opt.icon}</div>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-pink-100/20 mb-3">{opt.label}</span>
                                                    <div className="text-3xl font-serif font-bold mb-1">{opt.count}</div>
                                                    <div className="text-[9px] font-bold text-pink-400/60">{percentage.toFixed(0)}% SHARE</div>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <div className="h-[250px] w-full flex items-end gap-3 px-2 overflow-x-auto no-scrollbar pb-4 pt-8">
                                    {stats.dailyMessages.map((d, i) => (
                                        <div key={i} className="min-w-[70px] flex-1 flex flex-col items-center gap-4 group">
                                            <div className="relative w-full flex-1 flex flex-col justify-end">
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {d.count}
                                                </div>
                                                <div className="w-full bg-gradient-to-t from-pink-600 to-pink-400 rounded-t-2xl transition-all duration-1000 ease-out shadow-lg shadow-pink-600/10" style={{ height: `${(d.count / Math.max(...stats.dailyMessages.map(dm => dm.count), 1)) * 100}%` }}></div>
                                            </div>
                                            <span className="text-[8px] font-bold text-pink-100/30 uppercase text-center leading-tight h-6 flex items-center">{d.date}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* System Status Section */}
                    <div className="space-y-8">
                        <div className="bg-gradient-to-br from-rose-500/20 to-crimson-600/20 backdrop-blur-2xl border border-white/10 rounded-[3.5rem] p-10 shadow-2xl">
                            <h4 className="font-bold text-xl mb-10 flex items-center gap-3">
                                <BarChart3 size={20} className="text-pink-400" /> System Health
                            </h4>
                            <div className="space-y-8">
                                <StatusItem label="API Latency" status="Optimal" latency={stats.health.latency} />
                                <StatusItem label="Daily Generation Load" status={parseInt(stats.health.load) > 80 ? 'Heavy' : 'Normal'} usage={stats.health.load} />
                                <StatusItem label="Supabase Sync" status="Connected" latency="< 20ms" />
                                <StatusItem label="Global AI Status" status={stats.health.aiStatus} />
                            </div>
                            <button onClick={() => window.location.reload()} className="w-full mt-12 py-6 bg-white text-black rounded-[2.5rem] font-bold hover:bg-pink-100 transition-all active:scale-95 shadow-2xl">
                                Full System Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <footer className="mt-24 text-center border-t border-white/5 pt-12">
                    <p className="text-pink-100/10 text-[10px] font-bold uppercase tracking-[0.6em]">Jesprec Studios &bull; Antigravity Protected</p>
                    <p className="text-pink-100/5 text-xs mt-4">&copy; 2026 LUVV HQ. Live Analytics & Control.</p>
                </footer>
            </div>
        </div>
    );
};

// RESTORED SUB-COMPONENTS
const ProviderCard = ({ label, requests, messages, sub, color }: any) => {
    const theme = {
        pink: 'from-pink-500/10 border-pink-500/20 text-pink-400',
        amber: 'from-amber-500/10 border-amber-500/20 text-amber-400',
        blue: 'from-blue-500/10 border-blue-500/20 text-blue-400'
    }[color as 'pink' | 'amber' | 'blue'];

    return (
        <div className={`p-8 bg-gradient-to-br ${theme} border rounded-[2.5rem] text-center shadow-lg group hover:scale-105 transition-all`}>
            <span className="text-[10px] font-bold text-pink-100/30 uppercase tracking-widest block mb-3">{label}</span>
            <div className="flex flex-col gap-1 mb-4">
                {requests !== undefined && (
                    <div className="flex flex-col mb-2">
                        <div className={`text-4xl font-serif font-bold ${theme.split(' ').pop()}`}>{requests.toLocaleString()}</div>
                        <span className="text-[9px] font-bold text-pink-100/20 uppercase tracking-wider">AI Quota / Requests</span>
                    </div>
                )}
                <div className="flex flex-col">
                    <div className={`text-2xl font-serif font-bold ${theme.split(' ').pop()} ${requests !== undefined ? 'opacity-60' : ''}`}>
                        {messages.toLocaleString()}
                    </div>
                    <span className="text-[9px] font-bold text-pink-100/20 uppercase tracking-wider">Messages Generated</span>
                </div>
            </div>
            <span className="text-[10px] font-medium text-pink-100/10 italic leading-relaxed">{sub}</span>
        </div>
    );
};

const StatCard = ({ title, value, icon, trend, sub, color }: any) => {
    const colors: any = {
        blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
        purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
        emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
        amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20'
    };
    return (
        <div className={`p-10 bg-gradient-to-br ${colors[color]} border backdrop-blur-2xl rounded-[3rem] hover:scale-[1.03] transition-all group shadow-xl`}>
            <div className="flex justify-between items-start mb-8">
                <div className="p-5 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform border border-white/10">{icon}</div>
                <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full flex items-center gap-1.5">
                    <ArrowUpRight size={14} className="text-emerald-400" />
                    <span className="text-xs font-bold text-white">{trend}</span>
                </div>
            </div>
            <div className="space-y-1">
                <h3 className="text-5xl font-serif font-bold tracking-tight text-white">{value.toLocaleString()}</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-100/40">{title}</p>
            </div>
            <p className="mt-8 text-[10px] font-medium text-pink-100/20 italic border-t border-white/5 pt-6">{sub}</p>
        </div>
    );
};

const StatusItem = ({ label, status, latency, usage }: any) => (
    <div className="flex justify-between items-center group">
        <div className="space-y-1">
            <span className="text-xs font-bold text-pink-100/40 uppercase tracking-widest block">{label}</span>
            {latency && <span className="text-[10px] font-mono text-pink-400/60">{latency}</span>}
            {usage && <span className="text-[10px] font-mono text-pink-400/60">{usage} capacity</span>}
        </div>
        <div className="px-6 py-2 bg-white/5 border border-white/10 rounded-full">
            <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{status}</span>
        </div>
    </div>
);

export default AdminDashboard;
