import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { Search, ShieldAlert, AlertTriangle, CheckCircle, Loader2, Mail, Calendar, Database, Lock, Globe, Users, TrendingUp, Building } from 'lucide-react';
import api from '../api/axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface BreachDetail {
    breach: string;
    domain?: string;
    industry?: string;
    xposed_date?: string;
    xposed_records?: number;
    xposed_data?: string;
    details?: string;
    password_risk?: string;
    verified?: string;
    logo?: string;
}

interface BreachAnalytics {
    email: string;
    found: boolean;
    exposed_breaches?: BreachDetail[];
    risk?: {
        risk_score: number;
        risk_label: string;
    };
    exposed_data_types?: string[];
    pastes_count?: number;
    yearly_breakdown?: Record<string, number>;
    password_strength?: {
        plain_text: number;
        easy_to_crack: number;
        strong_hash: number;
        unknown: number;
    };
    industry_breakdown?: Record<string, number>;
}

// Chart colors
const PASSWORD_COLORS = ['#ef4444', '#f97316', '#22c55e', '#6b7280'];
const INDUSTRY_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];

const BreachChecker = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<BreachAnalytics | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searched, setSearched] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setError(null);
        setResult(null);
        setSearched(true);

        try {
            const response = await api.get(`/breaches/analytics/${encodeURIComponent(email)}`);
            console.log('API Response:', response.data);
            console.log('Found value:', response.data.found);
            setResult(response.data);
        } catch (err: any) {
            console.error('Error checking email:', err);
            setError(err.response?.data?.detail || 'Failed to check email. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (label: string) => {
        switch (label?.toLowerCase()) {
            case 'low': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
        }
    };

    const getPasswordRiskBadge = (risk: string) => {
        switch (risk?.toLowerCase()) {
            case 'plaintext': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'easytocrack': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'hardtocrack': return 'bg-green-500/10 text-green-500 border-green-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    return (
        <PageTransition className="relative">
            {/* Fixed Header */}
            <div className="fixed top-0 right-0 left-64 z-20 px-8 py-4 bg-white/95 dark:bg-gray-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                            <ShieldAlert className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Breach Checker</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Check if your email has been exposed in data breaches</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Spacer for Fixed Header */}
            <div className="h-24"></div>

            <div className="max-w-6xl mx-auto space-y-6">
                {/* Search Card */}
                <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Email Address</h2>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="flex gap-4">
                        <div className="flex-1">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter email address to check...."
                                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400 dark:placeholder-gray-600"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !email}
                            className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
                                loading || !email
                                    ? 'bg-blue-600/50 text-white/50 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                            }`}
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Search className="w-5 h-5" />
                            )}
                            Check Breaches
                        </button>
                    </form>
                </div>

                {/* Error State */}
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-center gap-3"
                    >
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <span className="text-red-600 dark:text-red-400">{error}</span>
                    </motion.div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-6 flex items-center justify-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-600 dark:text-blue-400">Checking for breaches...</span>
                    </div>
                )}

                {/* Results */}
                {result && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Status Card */}
                        {result.found ? (
                            <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10 rounded-xl p-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-full bg-red-100 dark:bg-red-500/10">
                                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">Email Found in Breaches</h3>
                                        <p className="text-red-600/80 dark:text-red-500/60 text-sm mt-1">
                                            This email was found in {result.exposed_breaches?.length || 0} data breach(es).
                                            We recommend changing your passwords immediately.
                                        </p>
                                    </div>
                                    {result.risk && (
                                        <div className={`px-4 py-2 rounded-lg border ${getRiskColor(result.risk.risk_label)}`}>
                                            <div className="text-xs uppercase tracking-wider font-medium">Risk Score</div>
                                            <div className="text-2xl font-bold">{result.risk.risk_score}/10</div>
                                            <div className="text-xs">{result.risk.risk_label}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/10 rounded-xl p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-full bg-green-100 dark:bg-green-500/10">
                                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">No Breaches Found</h3>
                                        <p className="text-green-600/80 dark:text-green-500/60 text-sm mt-1">
                                            Good news! This email was not found in any known data breaches.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Exposed Data Types */}
                        {result.exposed_data_types && result.exposed_data_types.length > 0 && (
                            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Database className="w-5 h-5 text-orange-500" />
                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Exposed Data Types</h2>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {result.exposed_data_types.map((dataType, index) => (
                                        <span 
                                            key={index}
                                            className="px-3 py-1.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg text-sm font-medium border border-orange-200 dark:border-orange-500/20"
                                        >
                                            {dataType}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Password Risks & Top Breaches Charts Row */}
                        {(result.password_strength || (result.exposed_breaches && result.exposed_breaches.length > 0)) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Password Risks Donut */}
                                {result.password_strength && (
                                    <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Lock className="w-5 h-5 text-purple-500" />
                                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Password Security</h2>
                                        </div>
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Plain Text', value: result.password_strength.plain_text },
                                                            { name: 'Easy to Crack', value: result.password_strength.easy_to_crack },
                                                            { name: 'Strong Hash', value: result.password_strength.strong_hash },
                                                            { name: 'Unknown', value: result.password_strength.unknown },
                                                        ].filter(d => d.value > 0)}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={80}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                                                        labelLine={false}
                                                    >
                                                        {[
                                                            { name: 'Plain Text', value: result.password_strength.plain_text },
                                                            { name: 'Easy to Crack', value: result.password_strength.easy_to_crack },
                                                            { name: 'Strong Hash', value: result.password_strength.strong_hash },
                                                            { name: 'Unknown', value: result.password_strength.unknown },
                                                        ].filter(d => d.value > 0).map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={PASSWORD_COLORS[index % PASSWORD_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Top Breaches by Records Donut */}
                                {result.exposed_breaches && result.exposed_breaches.length > 0 && (
                                    <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Users className="w-5 h-5 text-pink-500" />
                                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Top 5 Exposed Breaches</h2>
                                        </div>
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={result.exposed_breaches
                                                            .filter(b => b.xposed_records)
                                                            .sort((a, b) => (b.xposed_records || 0) - (a.xposed_records || 0))
                                                            .slice(0, 5)
                                                            .map(b => ({ name: b.breach, value: b.xposed_records || 0 }))}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={80}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                        label={({ name }) => name}
                                                        labelLine={false}
                                                    >
                                                        {result.exposed_breaches
                                                            .filter(b => b.xposed_records)
                                                            .sort((a, b) => (b.xposed_records || 0) - (a.xposed_records || 0))
                                                            .slice(0, 5)
                                                            .map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={INDUSTRY_COLORS[index % INDUSTRY_COLORS.length]} />
                                                            ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                                        formatter={(value) => [`${Number(value).toLocaleString()} records`, 'Exposed']}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Industry Breakdown */}
                        {result.industry_breakdown && Object.keys(result.industry_breakdown).length > 0 && (
                            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Building className="w-5 h-5 text-indigo-500" />
                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Industry Exposure</h2>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {Object.entries(result.industry_breakdown).map(([industry, count], index) => (
                                        <div 
                                            key={industry}
                                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800"
                                        >
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{industry}</span>
                                            <span 
                                                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                                style={{ backgroundColor: INDUSTRY_COLORS[index % INDUSTRY_COLORS.length] }}
                                            >
                                                {count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Yearly Trend Chart */}
                        {result.yearly_breakdown && Object.keys(result.yearly_breakdown).length > 0 && (
                            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-5 h-5 text-blue-500" />
                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Yearly Trend of Data Breaches</h2>
                                </div>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={Object.entries(result.yearly_breakdown)
                                                .map(([year, count]) => ({ year, count }))
                                                .sort((a, b) => parseInt(a.year) - parseInt(b.year))
                                                .filter(d => parseInt(d.year) >= 2010)
                                            }
                                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                        >
                                            <defs>
                                                <linearGradient id="colorBreaches" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                                            <XAxis 
                                                dataKey="year" 
                                                stroke="#6b7280" 
                                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                            />
                                            <YAxis 
                                                stroke="#6b7280" 
                                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                                allowDecimals={false}
                                            />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#1f2937', 
                                                    border: '1px solid #374151',
                                                    borderRadius: '8px',
                                                    color: '#fff'
                                                }}
                                                labelStyle={{ color: '#9ca3af' }}
                                                formatter={(value) => [`${value} breach${value !== 1 ? 'es' : ''}`, 'Count']}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="count" 
                                                stroke="#ef4444" 
                                                strokeWidth={2}
                                                fillOpacity={1} 
                                                fill="url(#colorBreaches)" 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Breach Details */}
                        {result.exposed_breaches && result.exposed_breaches.length > 0 && (
                            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-6">
                                    <ShieldAlert className="w-5 h-5 text-red-500" />
                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                                        Breach Details ({result.exposed_breaches.length})
                                    </h2>
                                </div>
                                
                                <div className="space-y-4">
                                    {result.exposed_breaches.map((breach, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                        {breach.breach}
                                                    </h4>
                                                    {breach.domain && (
                                                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                                                            <Globe className="w-3.5 h-3.5" />
                                                            {breach.domain}
                                                        </div>
                                                    )}
                                                </div>
                                                {breach.password_risk && (
                                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${getPasswordRiskBadge(breach.password_risk)}`}>
                                                        <Lock className="w-3 h-3 inline mr-1" />
                                                        {breach.password_risk}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {breach.details && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                                                    {breach.details}
                                                </p>
                                            )}
                                            
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                {breach.xposed_date && (
                                                    <div className="flex items-center gap-1.5 text-gray-500">
                                                        <Calendar className="w-4 h-4" />
                                                        <span>Breached: {breach.xposed_date}</span>
                                                    </div>
                                                )}
                                                {breach.xposed_records && (
                                                    <div className="flex items-center gap-1.5 text-gray-500">
                                                        <Users className="w-4 h-4" />
                                                        <span>{breach.xposed_records.toLocaleString()} records exposed</span>
                                                    </div>
                                                )}
                                                {breach.industry && (
                                                    <div className="flex items-center gap-1.5 text-gray-500">
                                                        <Database className="w-4 h-4" />
                                                        <span>{breach.industry}</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {breach.xposed_data && (
                                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Exposed Data:</span>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {breach.xposed_data.split(';').map((data, i) => (
                                                            <span 
                                                                key={i}
                                                                className="px-2 py-1 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 rounded text-xs border border-gray-200 dark:border-gray-800"
                                                            >
                                                                {data.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Empty State */}
                {!loading && !result && !error && searched === false && (
                    <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 border-dashed rounded-xl p-12 text-center">
                        <ShieldAlert className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Check Your Email Security</h3>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">
                            Enter an email address above to check if it has been exposed in any known data breaches.
                        </p>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default BreachChecker;
