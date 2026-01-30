"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { monitoringAPI, llmAPI } from "@/lib/api";
import { DashboardStats, TokenUsage } from "@/types";
import { formatTokens, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
    Activity,
    MessageSquare,
    Shield,
    Zap,
    TrendingUp,
    Clock,
    AlertTriangle,
    ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import { Button } from "@/components/ui/Button";

interface EventLog {
    id: string;
    event_type: string;
    event_action: string;
    resource_type?: string;
    details?: any;
    created_at: string;
}

interface SecurityLog {
    id: string;
    event_type: string;
    severity: string;
    details?: any;
    created_at: string;
}

const TIME_RANGES = [
    { label: "30M", value: 0.5 },
    { label: "1H", value: 1 },
    { label: "3H", value: 3 },
    { label: "5H", value: 5 },
    { label: "10H", value: 10 },
    { label: "24H", value: 24 },
];

// Provider-specific colors for intuitive recognition
const PROVIDER_COLORS: Record<string, string> = {
    google: "#4285F4",    // Google Blue
    claude: "#D97757",    // Claude Burnt Orange
    llama: "#00B2FF",     // Llama Light Blue
    groq: "#F55036",      // Groq Deep Orange
    openai: "#10a37f",    // OpenAI Emerald
    mistral: "#FFD700",   // Mistral Yellow/Gold
    glm: "#000000",       // Z.AI / GLM Black
    other: "var(--brand-red)"
};

const getModelColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("gemini") || lower.includes("google")) return PROVIDER_COLORS.google;
    if (lower.includes("claude") || lower.includes("anthropic")) return PROVIDER_COLORS.claude;
    if (lower.includes("llama") || lower.includes("meta")) return PROVIDER_COLORS.llama;
    if (lower.includes("groq")) return PROVIDER_COLORS.groq;
    if (lower.includes("gpt") || lower.includes("openai")) return PROVIDER_COLORS.openai;
    if (lower.includes("mistral")) return PROVIDER_COLORS.mistral;
    if (lower.includes("glm") || lower.includes("z-ai") || lower.includes("zai")) return PROVIDER_COLORS.glm;
    return PROVIDER_COLORS.other;
};

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [tokenUsage, setTokenUsage] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [modelData, setModelData] = useState<any[]>([]);
    const [events, setEvents] = useState<EventLog[]>([]);
    const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEventsLoading, setIsEventsLoading] = useState(false);
    const [isSecurityLoading, setIsSecurityLoading] = useState(false);
    const [chartError, setChartError] = useState(false);
    const [timeRange, setTimeRange] = useState(24);
    const [selectedModel, setSelectedModel] = useState("all");
    const [availableModels, setAvailableModels] = useState<string[]>([]);

    // Pagination States
    const [eventsPage, setEventsPage] = useState(1);
    const [totalEvents, setTotalEvents] = useState(0);
    const [securityPage, setSecurityPage] = useState(1);
    const [totalSecurity, setTotalSecurity] = useState(0);
    const PAGE_SIZE = 10;
    const SEC_PAGE_SIZE = 5;

    useEffect(() => {
        loadDashboard();
    }, []);

    useEffect(() => {
        loadChartData();
    }, [timeRange, selectedModel]);

    const loadDashboard = async () => {
        try {
            setIsLoading(true);
            const [statsRes, usageRes, eventsRes, securityRes] = await Promise.all([
                monitoringAPI.dashboard(),
                llmAPI.getUsage(),
                monitoringAPI.events(0, PAGE_SIZE),
                monitoringAPI.security(0, SEC_PAGE_SIZE),
            ]);

            setStats(statsRes.data);
            setTokenUsage(usageRes.data);
            setEvents(eventsRes.data.items);
            setTotalEvents(eventsRes.data.total);
            setSecurityLogs(securityRes.data.items);
            setTotalSecurity(securityRes.data.total);
            setEventsPage(1);
            setSecurityPage(1);
            loadChartData();
        } catch (error) {
            toast.error("Failed to load dashboard");
        } finally {
            setIsLoading(false);
        }
    };

    const loadMoreEvents = async () => {
        if (isEventsLoading || events.length >= totalEvents) return;
        try {
            setIsEventsLoading(true);
            const skip = eventsPage * PAGE_SIZE;
            const res = await monitoringAPI.events(skip, PAGE_SIZE);
            setEvents(prev => [...prev, ...res.data.items]);
            setEventsPage(prev => prev + 1);
        } catch (error) {
            toast.error("Failed to load more events");
        } finally {
            setIsEventsLoading(false);
        }
    };

    const loadMoreSecurity = async () => {
        if (isSecurityLoading || securityLogs.length >= totalSecurity) return;
        try {
            setIsSecurityLoading(true);
            const skip = securityPage * SEC_PAGE_SIZE;
            const res = await monitoringAPI.security(skip, SEC_PAGE_SIZE);
            setSecurityLogs(prev => [...prev, ...res.data.items]);
            setSecurityPage(prev => prev + 1);
        } catch (error) {
            toast.error("Failed to load more security logs");
        } finally {
            setIsSecurityLoading(false);
        }
    };

    const loadChartData = async () => {
        try {
            setChartError(false);
            const res = await llmAPI.getUsageChart(timeRange, selectedModel);
            const data = res.data || [];

            // Extract unique models for the dropdown
            if (availableModels.length === 0 && data.length > 0) {
                const models = Array.from(new Set(data.map((d: any) => d.model))) as string[];
                setAvailableModels(models);
            }

            // Group by time if needed, but for now just format
            setChartData(data.map((d: any) => ({
                ...d,
                time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));

            // Calculate model distribution for Pie Chart
            const modelCounts: Record<string, number> = {};
            data.forEach((log: any) => {
                modelCounts[log.model] = (modelCounts[log.model] || 0) + log.total_tokens;
            });

            const pieData = Object.entries(modelCounts).map(([name, value]) => ({ name, value }));
            setModelData(pieData);
        } catch (error) {
            console.error("Failed to load chart data");
            setChartError(true);
        }
    };

    const statCards = [
        {
            title: "Total Events",
            value: stats?.total_events || 0,
            icon: Activity,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
        },
        {
            title: "LLM Requests",
            value: stats?.total_llm_requests || 0,
            icon: MessageSquare,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
        },
        {
            title: "Total Tokens",
            value: formatTokens(stats?.total_tokens_used || 0),
            icon: Zap,
            color: "text-yellow-500",
            bgColor: "bg-yellow-500/10",
        },
        {
            title: "Security Events",
            value: stats?.total_security_events || 0,
            icon: Shield,
            color: "text-brand-red",
            bgColor: "bg-brand-red/10",
        },
    ];

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "critical":
                return "text-red-500 bg-red-500/10";
            case "high":
                return "text-orange-500 bg-orange-500/10";
            case "medium":
                return "text-yellow-500 bg-yellow-500/10";
            default:
                return "text-green-500 bg-green-500/10";
        }
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-4 pl-20 md:p-6 space-y-6 md:space-y-8 max-w-7xl mx-auto">
                {/* Header */}
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-app-text">Dashboard</h1>
                    <p className="text-app-text-secondary mt-1">Monitor your platform activity</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {statCards.map((stat, index) => (
                        <motion.div
                            key={stat.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-sm text-app-text-secondary">{stat.title}</p>
                                    <p className="text-2xl font-bold text-app-text">{stat.value}</p>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Token Usage */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {tokenUsage && (
                        <>
                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <Clock className="w-5 h-5 text-app-text-muted" />
                                    <h3 className="font-medium text-app-text">Daily Usage</h3>
                                </div>
                                <p className="text-3xl font-bold text-app-text">
                                    {formatTokens(tokenUsage.daily?.total_tokens || 0)}
                                </p>
                                <p className="text-sm text-app-text-muted mt-1">
                                    {tokenUsage.daily?.request_count || 0} requests today
                                </p>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <TrendingUp className="w-5 h-5 text-app-text-muted" />
                                    <h3 className="font-medium text-app-text">Weekly Usage</h3>
                                </div>
                                <p className="text-3xl font-bold text-app-text">
                                    {formatTokens(tokenUsage.weekly?.total_tokens || 0)}
                                </p>
                                <p className="text-sm text-app-text-muted mt-1">
                                    {tokenUsage.weekly?.request_count || 0} requests this week
                                </p>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <Activity className="w-5 h-5 text-app-text-muted" />
                                    <h3 className="font-medium text-app-text">Monthly Usage</h3>
                                </div>
                                <p className="text-3xl font-bold text-app-text">
                                    {formatTokens(tokenUsage.monthly?.total_tokens || 0)}
                                </p>
                                <p className="text-sm text-app-text-muted mt-1">
                                    {tokenUsage.monthly?.request_count || 0} requests this month
                                </p>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <ShieldCheck className={cn(
                                        "w-5 h-5",
                                        stats?.auth_status === 'secure' ? 'text-green-400' :
                                            stats?.auth_status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                                    )} />
                                    <h3 className="font-medium text-app-text">Security Health</h3>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-app-text-muted">Auth & Identity</span>
                                        <span className={cn(
                                            "font-bold uppercase",
                                            stats?.auth_status === 'secure' ? 'text-green-400' :
                                                stats?.auth_status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                                        )}>
                                            {stats?.auth_status === 'secure' ? 'SECURE' :
                                                stats?.auth_status === 'warning' ? 'AT RISK' : 'CRITICAL'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-app-text-muted">Rate Limiting</span>
                                        <span className="text-green-400 font-bold uppercase">{stats?.rate_limit_status || 'PROTECTED'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-app-text-muted">Integrity Scan</span>
                                        <span className="text-green-400 font-bold uppercase">{stats?.scan_status || 'PASSED'}</span>
                                    </div>
                                </div>
                            </Card>
                        </>
                    )}
                </div>

                {/* Token Usage & Distribution Section */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Time Series Chart */}
                    <Card className="xl:col-span-2 p-0 overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-app-card/50">
                            <div>
                                <h3 className="font-bold text-app-text flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-brand-red" />
                                    Usage Trends
                                </h3>
                                <p className="text-xs text-app-text-muted mt-1">Token consumption timeline</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="bg-app-bg border border-app-border rounded-lg px-3 py-1.5 text-xs text-app-text outline-none focus:border-brand-red min-w-[120px]"
                                >
                                    <option value="all">All Models</option>
                                    {availableModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>

                                <div className="flex bg-app-bg rounded-lg border border-app-border p-1">
                                    {TIME_RANGES.map((r) => (
                                        <button
                                            key={r.label}
                                            onClick={() => setTimeRange(r.value)}
                                            className={cn(
                                                "px-2.5 py-1 rounded text-[10px] font-bold transition-all",
                                                timeRange === r.value
                                                    ? "bg-brand-red text-white shadow-lg shadow-brand-red/20"
                                                    : "text-app-text-muted hover:text-app-text"
                                            )}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="h-[280px] sm:h-[320px] w-full p-4 flex items-center justify-center">
                            {chartError ? (
                                <div className="text-red-400 text-sm flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Failed to load chart data
                                </div>
                            ) : chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--brand-red)" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="var(--brand-red)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" opacity={0.3} vertical={false} />
                                        <XAxis
                                            dataKey="time"
                                            stroke="var(--brand-red)"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: 'var(--brand-red)', fontWeight: '600', opacity: 0.8 }}
                                        />
                                        <YAxis
                                            stroke="var(--brand-red)"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: 'var(--brand-red)', fontWeight: '600', opacity: 0.8 }}
                                            tickFormatter={(val) => val > 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--app-card)',
                                                borderColor: 'var(--app-border)',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                color: 'var(--app-text)'
                                            }}
                                            itemStyle={{ color: 'var(--app-text)' }}
                                        />
                                        <Area type="monotone" dataKey="total_tokens" stroke="var(--brand-red)" strokeWidth={3} fillOpacity={1} fill="url(#colorTokens)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-app-text-muted text-sm italic">No data available for this period</div>
                            )}
                        </div>
                    </Card>

                    {/* Model Distribution (Pie Chart) */}
                    <Card className="p-0 overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-app-border bg-app-card/50">
                            <h3 className="font-bold text-app-text flex items-center gap-2">
                                <Zap className="w-5 h-5 text-brand-red" />
                                Model Distribution
                            </h3>
                            <p className="text-xs text-app-text-muted mt-1">Usage ratio by AI engine</p>
                        </div>
                        <div className="h-[280px] sm:h-[320px] w-full p-4 flex items-center justify-center">
                            {chartError ? (
                                <div className="text-red-400 text-sm flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Failed to load
                                </div>
                            ) : modelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={modelData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {modelData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={getModelColor(entry.name)} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--app-card)',
                                                borderColor: 'var(--app-border)',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                color: 'var(--app-text)'
                                            }}
                                            itemStyle={{ color: 'var(--app-text)' }}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-app-text-muted text-sm italic">No data available</div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Recent Activity & Security */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Events */}
                    <Card className="flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-app-text flex items-center gap-2">
                                <Activity className="w-5 h-5 text-brand-red" />
                                Recent Activity
                            </h3>
                            <span className="text-[10px] text-app-text-muted bg-app-bg px-2 py-0.5 rounded-full border border-app-border">
                                {events.length} of {totalEvents}
                            </span>
                        </div>
                        <div className="space-y-3 max-h-80 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                            {events.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No events yet</p>
                            ) : (
                                <>
                                    {events.map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex items-center justify-between py-2 border-b border-app-border last:border-0"
                                        >
                                            <div>
                                                <p className="text-sm text-app-text">
                                                    <span className="text-brand-red font-medium">{event.event_action}</span>
                                                    {event.resource_type && (
                                                        <span className="text-app-text-secondary"> on {event.resource_type}</span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-app-text-muted">{event.event_type}</p>
                                            </div>
                                            <span className="text-[10px] text-app-text-muted bg-app-bg/50 px-1.5 py-0.5 rounded">
                                                {formatDate(event.created_at)}
                                            </span>
                                        </div>
                                    ))}
                                    {events.length < totalEvents && (
                                        <button
                                            onClick={loadMoreEvents}
                                            className="w-full py-2 text-xs text-brand-red hover:bg-brand-red/5 rounded-lg transition-colors font-medium mt-2"
                                            disabled={isEventsLoading}
                                        >
                                            {isEventsLoading ? "Loading..." : "Load More Activity"}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </Card>

                    {/* Security Logs */}
                    <Card className="flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-app-text flex items-center gap-2">
                                <Shield className="w-5 h-5 text-brand-red" />
                                Security Logs
                            </h3>
                            <span className="text-[10px] text-app-text-muted bg-app-bg px-2 py-0.5 rounded-full border border-app-border">
                                {securityLogs.length} of {totalSecurity}
                            </span>
                        </div>
                        <div className="space-y-3 max-h-80 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                            {securityLogs.length === 0 ? (
                                <p className="text-gray-500 text-center py-4 italic">No security events found</p>
                            ) : (
                                <>
                                    {securityLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="flex items-center justify-between py-2 border-b border-app-border last:border-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${getSeverityColor(log.severity)}`}
                                                >
                                                    {log.severity}
                                                </span>
                                                <p className="text-sm text-app-text">{log.event_type}</p>
                                            </div>
                                            <span className="text-[10px] text-app-text-muted bg-app-bg/50 px-1.5 py-0.5 rounded">
                                                {formatDate(log.created_at)}
                                            </span>
                                        </div>
                                    ))}
                                    {securityLogs.length < totalSecurity && (
                                        <button
                                            onClick={loadMoreSecurity}
                                            className="w-full py-2 text-xs text-brand-red hover:bg-brand-red/5 rounded-lg transition-colors font-medium mt-2"
                                            disabled={isSecurityLoading}
                                        >
                                            {isSecurityLoading ? "Loading..." : "Load More Security Logs"}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
