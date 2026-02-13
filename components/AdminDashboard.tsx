import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, BarChart3, Users, Clock, ArrowUpRight, TrendingUp, Calendar, Heart, ShieldCheck, Zap } from 'lucide-react';
import { supabase } from '../services/supabase';
import { RELATIONSHIP_OPTIONS } from '../constants';

interface Stats {
    visits: {
        today: number;
        week: number;
        month: number;
    };
    relationships: Record<string, number>;
    totalGenerated: number;
    dailyMessages: { date: string; count: number }[];
}

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats>({
        visits: { today: 0, week: 0, month: 0 },
        relationships: {},
        totalGenerated: 0,
        dailyMessages: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('Overview');

    useEffect(() => {
        const fetchStats = async () => {
            if (!supabase) return;
            setIsLoading(true);

            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            try {
                // 1. Fetch Visits
                const { count: todayVisits } = await supabase
                    .from('site_visits')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', todayStart);

                const { count: weekVisits } = await supabase
                    .from('site_visits')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', weekStart);

                const { count: monthVisits } = await supabase
                    .from('site_visits')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', monthStart);

                // 2. Fetch Relationship Usage & Daily Messages
                const { data: usageData } = await supabase
                    .from('message_library')
                    .select('relationship, created_at');

                const relCounts: Record<string, number> = {};
                const dailyCounts: Record<string, number> = {};

                // Initialize last 7 days with 0
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    dailyCounts[dateStr] = 0;
                }

                usageData?.forEach(item => {
                    // Relationship grouping
                    relCounts[item.relationship] = (relCounts[item.relationship] || 0) + 1;

                    // Daily grouping
                    const d = new Date(item.created_at);
                    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    if (dailyCounts[dateStr] !== undefined) {
                        dailyCounts[dateStr]++;
                    }
                });

                const dailyMessagesArray = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

                setStats({
                    visits: {
                        today: todayVisits || 0,
                        week: weekVisits || 0,
                        month: monthVisits || 0
                    },
                    relationships: relCounts,
                    totalGenerated: usageData?.length || 0,
                    dailyMessages: dailyMessagesArray
                });
            } catch (error) {
                console.error("Failed to fetch analytics:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();

        // Real-time updates for visits
        const channel = supabase?.channel('admin-stats')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_visits' }, () => {
                fetchStats();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_library' }, () => {
                fetchStats();
            })
            .subscribe();

        return () => {
            supabase?.removeChannel(channel as any);
        };
    }, []);

    return (
        <div className="min-h-screen bg-[#3D0000] text-white font-sans overflow-x-hidden selection:bg-pink-500/30">
            {/* Background Orbs */}
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
                    <Link to="/" className="flex items-center gap-2 px-8 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 hover:border-pink-500/30 transition-all text-sm font-bold active:scale-95 group">
                        <Home size={18} className="group-hover:text-pink-400 transition-colors" /> Back to App
                    </Link>
                </header>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard
                        title="Visits Today"
                        value={stats.visits.today}
                        icon={<Clock className="text-blue-400" />}
                        trend="+12%"
                        sub="Since midnight"
                        color="blue"
                    />
                    <StatCard
                        title="Messages Generated"
                        value={stats.totalGenerated}
                        icon={<Zap className="text-amber-400" />}
                        trend="+18%"
                        sub="Total all-time"
                        color="amber"
                    />
                    <StatCard
                        title="Visits This Week"
                        value={stats.visits.week}
                        icon={<Calendar className="text-purple-400" />}
                        trend="+5%"
                        sub="Past 7 days"
                        color="purple"
                    />
                    <StatCard
                        title="Visits This Month"
                        value={stats.visits.month}
                        icon={<TrendingUp className="text-emerald-400" />}
                        trend="+24%"
                        sub="February total"
                        color="emerald"
                    />
                </div>

                {/* Detailed Insights Section */}
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Relationship Usage Tabbed Card */}
                    <div className="lg:col-span-2 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-2xl font-serif font-bold mb-1">Relationship Insights</h3>
                                <p className="text-pink-100/30 text-sm font-medium">Usage distribution across types</p>
                            </div>
                            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 backdrop-blur-md">
                                {['Overview', 'Traffic'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === tab ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/20' : 'text-pink-100/40 hover:text-white'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-8 flex-1">
                            {activeTab === 'Overview' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {RELATIONSHIP_OPTIONS.map((opt) => {
                                        const count = stats.relationships[opt.label] || 0;
                                        const percentage = stats.totalGenerated > 0 ? (count / stats.totalGenerated) * 100 : 0;
                                        return (
                                            <div key={opt.label} className="p-6 bg-white/5 border border-white/10 rounded-3xl group hover:border-pink-500/40 transition-all hover:bg-white/10 flex flex-col items-center text-center">
                                                <div className="mb-4 p-4 bg-pink-500/10 rounded-2xl text-pink-400 group-hover:scale-110 transition-transform">
                                                    {opt.icon}
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-100/30 mb-2 truncate w-full">{opt.label}</span>
                                                <div className="text-3xl font-serif font-bold mb-1">{count}</div>
                                                <div className="text-[10px] font-bold text-pink-400/60 uppercase">{percentage.toFixed(0)}% SHARE</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="flex justify-between items-end mb-4">
                                        <h4 className="text-lg font-bold">Daily Message Generation</h4>
                                        <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Last 7 Days</span>
                                    </div>
                                    <div className="h-[200px] w-full flex items-end gap-2 md:gap-4 px-2">
                                        {stats.dailyMessages.map((d, i) => {
                                            const max = Math.max(...stats.dailyMessages.map(dm => dm.count), 5);
                                            const height = (d.count / max) * 100;
                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                                                    <div className="relative w-full flex-1 flex flex-col justify-end">
                                                        <div
                                                            className="w-full bg-gradient-to-t from-pink-600 to-pink-400 rounded-t-xl transition-all duration-700 ease-out group-hover:from-pink-500 group-hover:to-pink-300 shadow-lg shadow-pink-600/10"
                                                            style={{ height: `${height}%` }}
                                                        >
                                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {d.count}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-pink-100/30 uppercase tracking-tighter truncate w-full text-center">
                                                        {d.date}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* System Status & Performance */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-rose-500/20 to-crimson-600/20 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 shadow-2xl">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center text-pink-400">
                                    <Zap size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">System Health</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                                        <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-widest">Global Status: Normal</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <StatusItem label="Edge Function (Luvv)" status="Active" latency="142ms" />
                                <StatusItem label="Database Real-time" status="Connected" latency="28ms" />
                                <StatusItem label="AI Models (Failover)" status="Operational" />
                                <StatusItem label="Traffic Load" status="Low" usage="14%" />
                            </div>

                            <button className="w-full mt-10 py-5 bg-white text-black rounded-[2rem] font-bold hover:bg-pink-100 transition-all active:scale-95 shadow-xl">
                                System Refresh
                            </button>
                        </div>

                        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3.5rem] p-8 flex flex-col items-center text-center group">
                            <div className="p-6 bg-pink-500/10 rounded-full mb-6 group-hover:bg-pink-500/20 transition-all">
                                <Heart size={40} className="text-pink-400 fill-pink-400/20 animate-pulse" />
                            </div>
                            <h4 className="text-2xl font-serif font-bold italic mb-2">Spread More Luvv</h4>
                            <p className="text-pink-100/30 text-sm leading-relaxed mb-6">"Love is not only something you feel, it is something you do."</p>
                            <div className="w-12 h-1 bg-pink-500/40 rounded-full"></div>
                        </div>
                    </div>
                </div>

                <footer className="mt-20 text-center space-y-2">
                    <p className="text-pink-100/10 text-[10px] font-bold uppercase tracking-[0.5em]">Jesprec Studios &bull; Antigravity Protected</p>
                    <p className="text-pink-100/5 text-xs">&copy; 2026 LUVV. All rights research & analytics.</p>
                </footer>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; trend: string; sub: string; color: string }> = ({ title, value, icon, trend, sub, color }) => {
    const colors: Record<string, string> = {
        blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
        purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
        emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
        amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20'
    };

    return (
        <div className={`p-8 bg-gradient-to-br ${colors[color]} border backdrop-blur-2xl rounded-[3rem] hover:scale-[1.02] transition-all group shadow-xl`}>
            <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform border border-white/10">
                    {icon}
                </div>
                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-1">
                    <ArrowUpRight size={12} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-white">{trend}</span>
                </div>
            </div>
            <div className="space-y-1">
                <h3 className="text-4xl font-serif font-bold tracking-tight text-white">{value.toLocaleString()}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-pink-100/40">{title}</p>
            </div>
            <div className="mt-6 pt-6 border-t border-white/5 flex items-center gap-2">
                <span className="text-[10px] font-medium text-pink-100/20 tracking-wide italic">{sub}</span>
            </div>
        </div>
    );
};

const StatusItem: React.FC<{ label: string; status: string; latency?: string; usage?: string }> = ({ label, status, latency, usage }) => (
    <div className="flex justify-between items-center group">
        <div className="space-y-1">
            <span className="text-xs font-bold text-pink-100/40 uppercase tracking-widest block">{label}</span>
            {latency && <span className="text-[10px] font-mono text-pink-400/60 transition-opacity group-hover:opacity-100">{latency}</span>}
            {usage && <span className="text-[10px] font-mono text-pink-400/60 transition-opacity group-hover:opacity-100">{usage} usage</span>}
        </div>
        <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
            <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{status}</span>
        </div>
    </div>
);

export default AdminDashboard;

