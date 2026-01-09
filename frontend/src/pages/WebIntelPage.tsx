import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import {
  Globe, Search, Shield, Server, Lock, Mail, Database,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle,
  MapPin, Clock, Phone, Link as LinkIcon, Code, FileText,
  Wifi, Copy, Download, History, Trash2
} from 'lucide-react';
import api from '../api/axios';

// ============ Reusable Components ============

// Copy button with feedback
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
      )}
    </button>
  );
};

// Section with count badge
const Section = ({ title, icon: Icon, children, defaultOpen = false, badge, count }: { 
  title: string; 
  icon: any; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  count?: number;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900/50 overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-200">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
              {count}
            </span>
          )}
          {badge}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-200 dark:border-gray-800"
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const KeyValue = ({ label, value, copyable = false }: { label: string; value: any; copyable?: boolean }) => (
  <div className="flex justify-between items-start py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 gap-4">
    <span className="text-gray-600 dark:text-gray-400 text-sm flex-shrink-0">{label}</span>
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-gray-900 dark:text-gray-200 font-mono text-sm text-right break-words">{value || 'N/A'}</span>
      {copyable && value && <CopyButton text={String(value)} />}
    </div>
  </div>
);

const Badge = ({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) => {
  const colors: any = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs border ${colors[color]} inline-block`}>
      {children}
    </span>
  );
};

const StatusBadge = ({ found, label }: { found: boolean; label: string }) => (
  <div className="flex items-center gap-2">
    {found ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
    <span className={found ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
      {label}: {found ? 'Found' : 'Not Found'}
    </span>
  </div>
);



// History type
interface HistoryItem {
  id: number;
  target: string;
  mode: string;
  createdAt: string;
}

// ============ Main Component ============

export default function WebIntelPage() {
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState<'quick' | 'full'>('quick');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);


  // Load history from database on mount
  const loadHistory = async () => {
    try {
      const response = await api.get('/api/webintel/history');
      setHistory(response.data.history || []);
    } catch {
      // Silently fail - history is not critical
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Save to history via API
  const addToHistory = async (domain: string, searchMode: string) => {
    try {
      await api.post(`/api/webintel/history?target=${encodeURIComponent(domain)}&mode=${searchMode}`);
      loadHistory(); // Refresh history
    } catch {
      // Silently fail
    }
  };

  const clearHistory = async () => {
    try {
      await api.delete('/api/webintel/history');
      setHistory([]);
    } catch {
      // Silently fail
    }
  };

  const handleAnalyze = async () => {
    if (!target.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/api/webintel/analyze', { target, mode });
      setResult(response.data);
      // Save to database history
      const cleanTarget = target.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
      addToHistory(cleanTarget, mode);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const exportAsJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webintel-${result.target}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const data = result?.data || {};
  
  // Calculate counts
  const dnsCount = Object.values(data.dns_records || {}).flat().length;
  const osintCount = (data.osint?.emails?.length || 0) + (data.osint?.phones?.length || 0) + 
                     (data.osint?.social_profiles?.length || 0) + (data.osint?.internal_ips?.length || 0);

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Web Intelligence</h1>
        <p className="text-sm text-gray-500 mt-1">Instant domain analysis without running a full scan</p>
      </div>

      {/* Input Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Domain or URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                onFocus={() => history.length > 0 && setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                placeholder="example.com or https://example.com"
                className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {history.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  <History className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            
            {/* History Dropdown */}
            <AnimatePresence>
              {showHistory && history.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500">Recent searches</span>
                    <button onClick={clearHistory} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  </div>
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onMouseDown={() => { setTarget(h.target); setShowHistory(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                    >
                      <span>{h.target}</span>
                      <span className="text-xs text-gray-400">{h.mode}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'quick' | 'full')}
                className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="quick">Quick (HTTP Probe)</option>
                <option value="full">Full (With Crawl)</option>
              </select>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAnalyze}
              disabled={loading || !target.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Analyze
                </>
              )}
            </motion.button>
          </div>
        </div>
        

        
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-600 dark:text-red-400">{error}</span>
          </div>
        )}
      </div>



      {/* Results */}
      {result && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Overview Card - Subtle Dark Theme */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                {result.target}
              </h2>
              <div className="flex items-center gap-2">
                <Badge color={data.alive ? 'green' : 'red'}>
                  {data.alive ? 'ALIVE' : 'UNREACHABLE'}
                </Badge>
                <button
                  onClick={exportAsJson}
                  className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Export as JSON"
                >
                  <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Server, value: data.http_probe?.status_code || '-', label: 'Status', color: 'text-blue-500' },
                { icon: Clock, value: data.crawl_stats?.duration_sec ? `${data.crawl_stats.duration_sec.toFixed(1)}s` : (data.http_probe?.status_code ? 'Quick' : '-'), label: 'Duration', color: 'text-purple-500' },
                { icon: Database, value: data.dns_records?.A?.length || 0, label: 'A Records', color: 'text-green-500' },
                { icon: Shield, value: data.waf || 'None', label: 'WAF', color: 'text-orange-500' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center cursor-default transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <item.icon className={`w-5 h-5 ${item.color} mx-auto mb-1`} />
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{item.value}</p>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Resolved IPs */}
            {data.resolved_ips?.length > 0 && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-sm">IPs:</span>
                {data.resolved_ips.slice(0, 3).map((ip: string) => (
                  <span key={ip} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    {ip}
                    <CopyButton text={ip} />
                  </span>
                ))}
                {data.resolved_ips.length > 3 && (
                  <span className="text-gray-400 text-xs">+{data.resolved_ips.length - 3} more</span>
                )}
              </div>
            )}

            {/* Technologies */}
            {data.technologies?.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-sm">Tech:</span>
                {data.technologies.map((tech: string) => (
                  <Badge key={tech} color="blue">{tech}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* DNS Records */}
          <Section title="DNS Records" icon={Database} defaultOpen={true} count={dnsCount}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'].map(type => (
                <div key={type}>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    {type} Records
                    {data.dns_records?.[type]?.length > 0 && (
                      <span className="text-xs text-gray-400">({data.dns_records[type].length})</span>
                    )}
                  </h4>
                  {data.dns_records?.[type]?.length > 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {type === 'MX' ? (
                        data.dns_records[type].map((r: any, i: number) => (
                          <div key={i} className="text-sm font-mono text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                            <span>[{r.priority}] {r.host}</span>
                            <CopyButton text={r.host} />
                          </div>
                        ))
                      ) : (
                        data.dns_records[type].map((r: string, i: number) => (
                          <div key={i} className="text-sm font-mono text-gray-700 dark:text-gray-300 mb-1 break-all flex items-center justify-between">
                            <span className="flex-1 truncate">{r}</span>
                            <CopyButton text={r} />
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No records found</p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Email Security */}
          <Section 
            title="Email Security" 
            icon={Mail}
            badge={
              <Badge color={
                data.email_security?.spf?.found && data.email_security?.dmarc?.found ? 'green' :
                data.email_security?.spf?.found || data.email_security?.dmarc?.found ? 'yellow' : 'red'
              }>
                {data.email_security?.spf?.found && data.email_security?.dmarc?.found ? 'Secure' :
                 data.email_security?.spf?.found || data.email_security?.dmarc?.found ? 'Partial' : 'Vulnerable'}
              </Badge>
            }
          >
            <div className="space-y-4">
              <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
                <StatusBadge found={data.email_security?.spf?.found} label="SPF" />
                {data.email_security?.spf?.record && (
                  <div className="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 flex items-start justify-between gap-2">
                    <code className="text-xs text-gray-600 dark:text-gray-400 break-all flex-1">
                      {data.email_security.spf.record}
                    </code>
                    <CopyButton text={data.email_security.spf.record} />
                  </div>
                )}
              </div>
              
              <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
                <div className="flex items-center justify-between">
                  <StatusBadge found={data.email_security?.dmarc?.found} label="DMARC" />
                  {data.email_security?.dmarc?.policy && (
                    <Badge color={
                      data.email_security.dmarc.policy === 'reject' ? 'green' :
                      data.email_security.dmarc.policy === 'quarantine' ? 'yellow' : 'gray'
                    }>
                      Policy: {data.email_security.dmarc.policy}
                    </Badge>
                  )}
                </div>
                {data.email_security?.dmarc?.record && (
                  <div className="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 flex items-start justify-between gap-2">
                    <code className="text-xs text-gray-600 dark:text-gray-400 break-all flex-1">
                      {data.email_security.dmarc.record}
                    </code>
                    <CopyButton text={data.email_security.dmarc.record} />
                  </div>
                )}
              </div>
              
              <div>
                <StatusBadge found={data.email_security?.dkim?.found} label="DKIM" />
                {data.email_security?.dkim?.found && (
                  <p className="text-sm text-gray-500 mt-1">Selector: {data.email_security.dkim.selector}</p>
                )}
              </div>
            </div>
          </Section>

          {/* DNSSEC */}
          <Section 
            title="DNSSEC" 
            icon={Lock}
            badge={<Badge color={data.dnssec?.enabled ? 'green' : 'gray'}>
              {data.dnssec?.enabled ? 'Enabled' : 'Not Enabled'}
            </Badge>}
          >
            {data.dnssec?.enabled ? (
              <div className="space-y-3">
                {data.dnssec.dnskey?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">DNSKEY Records</h4>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 max-h-24 overflow-y-auto">
                      {data.dnssec.dnskey.map((r: string, i: number) => (
                        <div key={i} className="text-xs font-mono text-gray-600 dark:text-gray-400 mb-1 truncate">{r}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">DNSSEC is not configured for this domain.</p>
            )}
          </Section>

          {/* WHOIS */}
          <Section title="WHOIS Information" icon={FileText}>
            {data.whois?.found ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <KeyValue label="Registrar" value={data.whois.registrar} copyable />
                  <KeyValue label="Created" value={data.whois.creation_date?.split('T')[0]} />
                  <KeyValue label="Expires" value={data.whois.expiration_date?.split('T')[0]} />
                </div>
                <div>
                  <KeyValue label="Registrant" value={data.whois.registrant} />
                  <KeyValue label="Country" value={data.whois.country} />
                  <KeyValue label="Name Servers" value={data.whois.name_servers?.slice(0, 2).join(', ')} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">WHOIS information not available.</p>
            )}
          </Section>

          {/* IP Location */}
          <Section title="IP Geolocation" icon={MapPin}>
            {data.ip_location?.found ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <KeyValue label="IP Address" value={data.ip_location.ip} copyable />
                  <KeyValue label="Country" value={`${data.ip_location.country} (${data.ip_location.country_code})`} />
                  <KeyValue label="City" value={data.ip_location.city} />
                </div>
                <div>
                  <KeyValue label="ISP" value={data.ip_location.isp} />
                  <KeyValue label="Organization" value={data.ip_location.org} />
                  <KeyValue label="ASN" value={data.ip_location.asn} copyable />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">IP location not available.</p>
            )}
          </Section>

          {/* TLS Certificate */}
          <Section title="TLS Certificate" icon={Lock}>
            {data.tls_info?.issuer ? (
              <div className="space-y-3">
                <KeyValue label="Issuer" value={data.tls_info.issuer} />
                <KeyValue label="Subject" value={data.tls_info.subject} />
                <KeyValue label="Valid From" value={data.tls_info.not_before} />
                <KeyValue label="Valid To" value={data.tls_info.not_after} />
                {data.tls_info.san?.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Subject Alternative Names</p>
                    <div className="flex flex-wrap gap-2">
                      {data.tls_info.san.slice(0, 5).map((san: string) => (
                        <span key={san} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          {san}
                          <CopyButton text={san} />
                        </span>
                      ))}
                      {data.tls_info.san.length > 5 && (
                        <Badge color="gray">+{data.tls_info.san.length - 5} more</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">TLS certificate information not available.</p>
            )}
          </Section>

          {/* Security Headers */}
          <Section title="Security Headers" icon={Shield} count={Object.values(data.security_headers || {}).filter(Boolean).length}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(data.security_headers || {}).map(([key, value]) => (
                <motion.div 
                  key={key} 
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  {value ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                </motion.div>
              ))}
            </div>
          </Section>

          {/* Blacklist Check */}
          <Section 
            title="IP Blacklist Check" 
            icon={AlertTriangle}
            badge={data.blacklist?.clean !== undefined && (
              <Badge color={data.blacklist.clean ? 'green' : 'red'}>
                {data.blacklist.clean ? 'Clean' : `Listed in ${data.blacklist.listed_count} DNSBL`}
              </Badge>
            )}
          >
            {data.blacklist?.results ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {data.blacklist.results.map((r: any) => (
                  <div key={r.dnsbl} className="flex items-center gap-2 py-1">
                    {r.listed ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{r.dnsbl}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Blacklist check not performed.</p>
            )}
          </Section>

          {/* Traceroute */}
          <Section title="Traceroute" icon={Wifi} count={data.traceroute?.hops?.length}>
            {data.traceroute?.hops?.length > 0 ? (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {data.traceroute.hops.map((hop: any) => (
                  <div key={hop.hop} className="flex items-center gap-4 py-1 text-sm">
                    <span className="w-6 text-gray-500 font-mono">{hop.hop}</span>
                    <span className="flex-1 font-mono text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      {hop.timeout ? '* * *' : hop.ip}
                      {hop.ip && <CopyButton text={hop.ip} />}
                    </span>
                    {hop.time_ms && <span className="text-gray-500">{hop.time_ms}ms</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Traceroute data not available.</p>
            )}
          </Section>

          {/* OSINT Data */}
          {data.osint && (
            <Section title="OSINT Data" icon={Search} count={osintCount}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Emails */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Emails ({data.osint.emails?.length || 0})
                  </h4>
                  {data.osint.emails?.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside max-h-32 overflow-y-auto">
                      {data.osint.emails.map((e: string) => (
                        <li key={e} className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
                          <span>{e}</span>
                          <CopyButton text={e} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">No emails found</p>
                  )}
                </div>
                
                {/* Phones */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Phones ({data.osint.phones?.length || 0})
                  </h4>
                  {data.osint.phones?.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside max-h-48 overflow-y-auto">
                      {data.osint.phones.map((p: string) => (
                        <li key={p} className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
                          <span>{p}</span>
                          <CopyButton text={p} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">No phones found</p>
                  )}
                </div>
                
                {/* Social Profiles */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" /> Social Profiles ({data.osint.social_profiles?.length || 0})
                  </h4>
                  {data.osint.social_profiles?.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside max-h-48 overflow-y-auto">
                      {data.osint.social_profiles.map((s: string) => (
                        <li key={s} className="flex items-center justify-between">
                          <a href={s} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[80%]">
                            {s}
                          </a>
                          <CopyButton text={s} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">No profiles found</p>
                  )}
                </div>

                {/* Internal IPs */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    # Internal IPs ({data.osint.internal_ips?.length || 0})
                  </h4>
                  {data.osint.internal_ips?.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside max-h-32 overflow-y-auto">
                      {data.osint.internal_ips.map((ip: string) => (
                        <li key={ip} className="text-sm text-gray-700 dark:text-gray-300 font-mono flex items-center justify-between">
                          <span>{ip}</span>
                          <CopyButton text={ip} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">No internal IPs found</p>
                  )}
                </div>
                
                {/* API Endpoints */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4" /> API Endpoints ({data.osint.api_endpoints?.length || 0})
                  </h4>
                  {data.osint.api_endpoints?.length > 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 max-h-32 overflow-y-auto">
                      {data.osint.api_endpoints.map((e: string) => (
                        <div key={e} className="text-xs font-mono text-gray-600 dark:text-gray-400 flex items-center justify-between mb-1">
                          <span className="truncate">{e}</span>
                          <CopyButton text={e} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No endpoints found</p>
                  )}
                </div>
              </div>

              {/* Interesting Comments */}
              {data.osint.comments?.length > 0 && (
                <div className="mt-6 border-t border-gray-200 dark:border-gray-800 pt-4">
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4" /> Interesting Comments ({data.osint.comments.length})
                  </h4>
                  <div className="bg-gray-100 dark:bg-black/30 p-3 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-400 max-h-48 overflow-y-auto">
                    {data.osint.comments.map((c: string, i: number) => (
                      <div key={i} className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-800 last:border-0 whitespace-pre-wrap break-all">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}
        </motion.div>
      )}
    </PageTransition>
  );
}
