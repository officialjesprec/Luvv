// ... existing imports ...
import { performance } from 'perf-hooks'; // For measuring latency

interface Stats {
    visits: { today: number; yesterday: number; week: number; lastWeek: number; month: number };
    relationships: Record<string, number>;
    totalGenerated: number;
    totalGeneratedYesterday: number;
    dailyMessages: { date: string; count: number }[];
    health: { latency: string; load: string; aiStatus: string };
}

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats>({
        visits: { today: 0, yesterday: 0, week: 0, lastWeek: 0, month: 0 },
        relationships: {},
        totalGenerated: 0,
        totalGeneratedYesterday: 0,
        dailyMessages: [],
        health: { latency: '0ms', load: '0%', aiStatus: 'Checking...' }
    });
    const [isLoading, setIsLoading] = useState(true);

    const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? '+100%' : '0%';
        const diff = ((current - previous) / previous) * 100;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    };

    const fetchStats = async () => {
        if (!supabase) return;
        const startTime = Date.now(); // Start timer for latency
        setIsLoading(true);

        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        const yesterdayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

        try {
            // 1. Fetch Visits with Comparison
            const [today, yesterday, week, lastWeek, month] = await Promise.all([
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', lastWeekStart).lt('created_at', weekStart),
                supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
            ]);

            // 2. Fetch Generation Data
            const { data: usageData } = await supabase.from('message_library').select('relationship, created_at');
            const endTime = Date.now(); // End timer

            // 3. Calculate Traffic Load (Based on your 250 AI daily limit)
            const generatedToday = usageData?.filter(i => i.created_at >= todayStart).length || 0;
            const generatedYesterday = usageData?.filter(i => i.created_at >= yesterdayStart && i.created_at < todayStart).length || 0;
            const loadPercent = Math.min((generatedToday / 250) * 100, 100).toFixed(0);

            // ... (Your existing relationship and dailyMessages logic) ...

            setStats(prev => ({
                ...prev,
                visits: {
                    today: today.count || 0,
                    yesterday: yesterday.count || 0,
                    week: week.count || 0,
                    lastWeek: lastWeek.count || 0,
                    month: month.count || 0
                },
                totalGenerated: usageData?.length || 0,
                totalGeneratedYesterday: generatedYesterday,
                health: {
                    latency: `${endTime - startTime}ms`,
                    load: `${loadPercent}%`,
                    aiStatus: (today.count ?? 0) > 0 ? 'Operational' : 'Idle'
                }
            }));
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setIsLoading(false);
        }
    };
    // ... rest of component ...
