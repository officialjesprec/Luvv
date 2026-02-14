import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Clock, ArrowUpRight, TrendingUp, Calendar, Heart, ShieldCheck, Zap, Activity } from 'lucide-react';
import { supabase } from '../services/supabase';
import { RELATIONSHIP_OPTIONS } from '../constants';

interface Stats {
    visits: { today: number; yesterday: number; week: number; lastWeek: number; month: number };
    relationships: Record<string, number>;
    totalGenerated: number;
    totalGeneratedYesterday: number;
    dailyMessages: { date: string; count: number }[];
    providers: { gemini: number; groq: number; safetyNet: number }; // NEW: Provider tracking
    health: { latency: string; load: string; aiStatus: string; }
}

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats>({
        visits: { today: 0, yesterday: 0, week: 0, lastWeek: 0, month: 0 },
        relationships: {},
        totalGenerated: 0,
        totalGeneratedYesterday: 0,
        dailyMessages: [],
        providers: { gemini: 0, groq: 0, safetyNet: 0 },
        health: { latency: '0ms', load: '0%', aiStatus: 'Checking...' }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('Overview');

    const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? '+100%' : '0%';
        const diff = ((current - previous) / previous) * 100;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    };

    const fetchStats = async () => {
        if (!supabase) return;
        const startTime = Date.now();
        setIsLoading(true);

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const yesterdayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

        try {
            const [today, yesterday, week, lastWeek, month] = await Promise.all([
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', lastWeekStart).lt('created_at', weekStart),
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
            ]);

            const { data: usageData } = await supabase.from('message_library').select('relationship, created_at, provider');
            const endTime = Date.now();

            const relCounts: Record<string, number> = {};
            const dailyCounts: Record<string, number> = {};
            const providerCounts = { gemini: 0, groq: 0, safetyNet: 0 };

            // Initialize last 7 days
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                dailyCounts[d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })] = 0;
            }

            let generatedToday = 0;
            let generatedYesterday = 0;

            usageData?.forEach(item => {
                relCounts[item.relationship] = (relCounts[item.relationship] || 0) + 1;
                if (item.created_at >= todayStart) generatedToday++;
                if (item.created_at >= yesterdayStart && item.created_at < todayStart) generatedYesterday++;
                
                // Track Provider Mix
                if (item.provider?.includes('gemini')) providerCounts.gemini++;
                else if (item.provider?.includes('groq')) providerCounts.groq++;
                else if (item.provider?.includes('safety-net')) providerCounts.safetyNet++;

                const dateStr = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                if (dailyCounts[dateStr] !== undefined) dailyCounts[dateStr]++;
            });

            setStats({
                visits: { today: today.count || 0, yesterday: yesterday.count || 0, week: week.count || 0, lastWeek: lastWeek.count || 0, month: month.count || 0 },
                relationships: relCounts,
                totalGenerated: usageData?.length || 0,
                totalGeneratedYesterday: generatedYesterday,
                dailyMessages: Object.entries(dailyCounts).map(([date, count]) => ({ date, count })),
                providers: providerCounts,
                health: {
                    latency: `${endTime - startTime}ms`,
                    load: `${Math.min((generatedToday / 250) * 100, 100).toFixed(0)}%`,
                    aiStatus: (today.count ?? 0) > 0 ? 'Operational' : 'Active'
                }
            });
        } catch (error) { console.error("Analytics Error:", error); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchStats();
        const channel = supabase?.channel('admin-stats').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_library' }, () => fetchStats()).subscribe();
        return () => { supabase?.removeChannel(channel as any); };
    }, []);

    return (
        <div className="min-h-screen bg-[#3D0000] text-white font-sans overflow-x-hidden selection:bg-pink-500/30">
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-pink-600 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-crimson-800 rounded-full blur-[150px]"></div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-pink-500 to-crimson-600 rounded-2xl shadow-xl shadow-pink-500/10"><ShieldCheck size={28} /></div>
                            <h1 className="text-4xl font-serif font-bold italic">Luvv HQ <span className="text-pink-400">Analytics</span></h1>
                        </div>
                        <p className="text-pink-100/40 font-medium pl-14">Real-time Performance Hub</p>
                    </div>
                    <Link to="/" className="flex items-center gap-2 px-8 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-95 group">
                        <Home size={18} className="group-hover:text-pink-400" /> Back to App
                    </Link>
                </header>

                {/* Performance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard title="Visits Today" value={stats.visits.today} icon={<Clock className="text-blue-400" />} trend={calculateTrend(stats.visits.today, stats.visits.yesterday)} sub="Since midnight" color="blue" />
                    <StatCard title="Messages Total" value={stats.totalGenerated} icon={<Zap className="text-amber-400" />} trend={calculateTrend(stats.totalGenerated, stats.totalGeneratedYesterday)} sub="Lifetime" color="amber" />
                    <StatCard title="Visits (Week)" value={stats.visits.week} icon={<Calendar className="text-purple-400" />} trend={calculateTrend(stats.visits.week, stats.visits.lastWeek)} sub="Past 7 days" color="purple" />
                    <StatCard title="Visits (Month)" value={stats.visits.month} icon={<TrendingUp className="text-emerald-400" />} trend="+100%" sub="February total" color="emerald" />
                </div>

                {/* NEW: Provider Mix Section */}
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 shadow-2xl mb-12">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-2xl font-serif font-bold">AI Generation Mix</h3>
                            <p className="text-pink-100/30 text-sm">Real-time usage of Gemini vs Groq vs Safety Net</p>
                        </div>
                        <Activity className="text-pink-400 animate-pulse" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ProviderBox label="Gemini 2.5 (Primary)" value={stats.providers.gemini} color="border-pink-500/30" textColor="text-pink-400" />
                        <ProviderBox label="Groq Llama (Failover)" value={stats.providers.groq} color="border-amber-500/30" textColor="text-amber-400" />
                        <ProviderBox label="Safety Net (Database)" value={stats.providers.safetyNet} color="border-blue-500/30" textColor="text-blue-400" />
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-serif font-bold">Relationships</h3>
                            <div className="flex bg-white/5 p-1 rounded-xl">
                                {['Overview', 'Traffic'].map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-pink-600' : 'text-pink-100/40'}`}>{tab}</button>
                                ))}
                            </div>
                        </div>
                        {activeTab === 'Overview' ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {RELATIONSHIP_OPTIONS.map((opt) => (
                                    <div key={opt.label} className="p-6 bg-white/5 border border-white/10 rounded-3xl text-center">
                                        <div className="mb-2 text-pink-400 opacity-50">{opt.icon}</div>
                                        <div className="text-[10px] font-bold text-pink-100/30 uppercase">{opt.label}</div>
                                        <div className="text-2xl font-bold">{stats.relationships[opt.label] || 0}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-[200px] flex items-end gap-3">
                                {stats.dailyMessages.map((d, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                        <div className="w-full bg-pink-500/40 rounded-t-lg transition-all duration-1000" style={{ height: `${(d.count / Math.max(...stats.dailyMessages.map(dm => dm.count), 5)) * 100}%` }}></div>
                                        <span className="text-[9px] text-pink-100/30">{d.date}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-gradient-to-br from-rose-500/10 to-crimson-600/10 border border-white/10 rounded-[3rem] p-8">
                        <h4 className="font-bold text-lg mb-8">System Health</h4>
                        <div className="space-y-6">
                            <StatusItem label="API Latency" status="Optimal" latency={stats.health.latency} />
                            <StatusItem label="Daily AI Load" status={parseInt(stats.health.load) > 80 ? 'Heavy' : 'Light'} usage={stats.health.load} />
                            <StatusItem label="Database" status="Synced" latency="< 20ms" />
                            <StatusItem label="App Status" status={stats.health.aiStatus} />
                        </div>
                        <button onClick={() => fetchStats()} className="w-full mt-10 py-5 bg-white text-black rounded-3xl font-bold active:scale-95 transition-all">Manual Refresh</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProviderBox = ({ label, value, color, textColor }: any) => (
    <div className={`p-6 bg-white/5 border ${color} rounded-[2rem] text-center`}>
        <span className="text-[10px] font-bold text-pink-100/30 uppercase tracking-[0.2em] mb-2 block">{label}</span>
        <div className={`text-4xl font-serif font-bold ${textColor}`}>{value}</div>
    </div>
);

const StatCard = ({ title, value, icon, trend, sub, color }: any) => {
    const bg = { blue: 'from-blue-500/10', purple: 'from-purple-500/10', emerald: 'from-emerald-500/10', amber: 'from-amber-500/10' }[color as 'blue' | 'purple' | 'emerald' | 'amber'];
    return (
        <div className={`p-8 bg-gradient-to-br ${bg} border border-white/5 rounded-[3rem] shadow-xl hover:scale-105 transition-all`}>
            <div className="flex justify-between mb-6">
                <div className="p-3 bg-white/5 rounded-xl">{icon}</div>
                <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-white/5 px-2 rounded-full"><ArrowUpRight size={10} /> {trend}</div>
            </div>
            <h3 className="text-4xl font-serif font-bold">{value.toLocaleString()}</h3>
            <p className="text-[10px] font-bold uppercase text-pink-100/40">{title}</p>
        </div>
    );
};

const StatusItem = ({ label, status, latency, usage }: any) => (
    <div className="flex justify-between items-center">
        <div>
            <span className="text-[10px] font-bold text-pink-100/30 uppercase block">{label}</span>
            {latency && <span className="text-[10px] text-pink-400 font-mono">{latency}</span>}
            {usage && <span className="text-[10px] text-pink-400 font-mono">{usage} load</span>}
        </div>
        <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold">{status}</div>
    </div>
);

export default AdminDashboard;
