import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import {
  Globe, Search, Shield, Server, Lock, Mail, Database,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle,
  MapPin, Clock, Phone, Link as LinkIcon, Code, FileText,
  Wifi
} from 'lucide-react';
import api from '../api/axios';

// ============ Reusable Components ============

const Section = ({ title, icon: Icon, children, defaultOpen = false, badge }: { 
  title: string; 
  icon: any; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: React.ReactNode;
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
          {badge}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>
      {isOpen && <div className="p-4 border-t border-gray-200 dark:border-gray-800">{children}</div>}
    </div>
  );
};

const KeyValue = ({ label, value }: { label: string; value: any }) => (
  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <span className="text-gray-600 dark:text-gray-400 text-sm">{label}</span>
    <span className="text-gray-900 dark:text-gray-200 font-mono text-sm text-right max-w-[60%] truncate">{value || 'N/A'}</span>
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
    {found ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    )}
    <span className={found ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
      {label}: {found ? 'Found' : 'Not Found'}
    </span>
  </div>
);

// ============ Main Component ============

export default function WebIntelPage() {
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState<'quick' | 'full'>('quick');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!target.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/webintel/analyze', { target, mode });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const data = result?.data || {};

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
          <div className="flex-1">
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
                placeholder="example.com or https://example.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
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
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
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
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Overview Card */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                {result.target}
              </h2>
              <Badge color={data.alive ? 'green' : 'red'}>
                {data.alive ? 'ALIVE' : 'UNREACHABLE'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                <Server className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {data.http_probe?.status_code || '-'}
                </p>
                <p className="text-xs text-gray-500">Status</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                <Clock className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {data.crawl_stats?.duration_sec ? `${data.crawl_stats.duration_sec}s` : '-'}
                </p>
                <p className="text-xs text-gray-500">Duration</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                <Database className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {data.dns_records?.A?.length || 0}
                </p>
                <p className="text-xs text-gray-500">A Records</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                <Shield className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {data.waf || 'None'}
                </p>
                <p className="text-xs text-gray-500">WAF</p>
              </div>
            </div>

            {/* Technologies */}
            {data.technologies?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Technologies</p>
                <div className="flex flex-wrap gap-2">
                  {data.technologies.map((tech: string) => (
                    <Badge key={tech} color="blue">{tech}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DNS Records */}
          <Section title="DNS Records" icon={Database} defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'].map(type => (
                <div key={type}>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{type} Records</h4>
                  {data.dns_records?.[type]?.length > 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {type === 'MX' ? (
                        data.dns_records[type].map((r: any, i: number) => (
                          <div key={i} className="text-sm font-mono text-gray-700 dark:text-gray-300 mb-1">
                            [{r.priority}] {r.host}
                          </div>
                        ))
                      ) : (
                        data.dns_records[type].map((r: string, i: number) => (
                          <div key={i} className="text-sm font-mono text-gray-700 dark:text-gray-300 mb-1 break-all">
                            {r}
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
              {/* SPF */}
              <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
                <StatusBadge found={data.email_security?.spf?.found} label="SPF" />
                {data.email_security?.spf?.record && (
                  <div className="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <code className="text-xs text-gray-600 dark:text-gray-400 break-all">
                      {data.email_security.spf.record}
                    </code>
                  </div>
                )}
              </div>
              
              {/* DMARC */}
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
                  <div className="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <code className="text-xs text-gray-600 dark:text-gray-400 break-all">
                      {data.email_security.dmarc.record}
                    </code>
                  </div>
                )}
              </div>
              
              {/* DKIM */}
              <div>
                <StatusBadge found={data.email_security?.dkim?.found} label="DKIM" />
                {data.email_security?.dkim?.found && (
                  <p className="text-sm text-gray-500 mt-1">
                    Selector: {data.email_security.dkim.selector}
                  </p>
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
                  <KeyValue label="Registrar" value={data.whois.registrar} />
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
                  <KeyValue label="IP Address" value={data.ip_location.ip} />
                  <KeyValue label="Country" value={`${data.ip_location.country} (${data.ip_location.country_code})`} />
                  <KeyValue label="City" value={data.ip_location.city} />
                </div>
                <div>
                  <KeyValue label="ISP" value={data.ip_location.isp} />
                  <KeyValue label="Organization" value={data.ip_location.org} />
                  <KeyValue label="ASN" value={data.ip_location.asn} />
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
                        <Badge key={san} color="gray">{san}</Badge>
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
          <Section title="Security Headers" icon={Shield}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(data.security_headers || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  {value ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
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
                    {r.listed ? (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{r.dnsbl}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Blacklist check not performed.</p>
            )}
          </Section>

          {/* Traceroute */}
          <Section title="Traceroute" icon={Wifi}>
            {data.traceroute?.hops?.length > 0 ? (
              <div className="space-y-1">
                {data.traceroute.hops.map((hop: any) => (
                  <div key={hop.hop} className="flex items-center gap-4 py-1 text-sm">
                    <span className="w-6 text-gray-500 font-mono">{hop.hop}</span>
                    <span className="flex-1 font-mono text-gray-700 dark:text-gray-300">
                      {hop.timeout ? '* * *' : hop.ip}
                    </span>
                    {hop.time_ms && (
                      <span className="text-gray-500">{hop.time_ms}ms</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Traceroute data not available.</p>
            )}
          </Section>

          {/* OSINT Data (only in full mode) */}
          {data.osint && (
            <Section title="OSINT Data" icon={Search}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Emails */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Emails ({data.osint.emails?.length || 0})
                  </h4>
                  {data.osint.emails?.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                      {data.osint.emails.map((e: string) => (
                        <li key={e} className="text-sm text-gray-700 dark:text-gray-300">{e}</li>
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
                        <li key={p} className="text-sm text-gray-700 dark:text-gray-300">{p}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">No phones found</p>
                  )}
                </div>
                
                {/* Social Profiles - Show ALL */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" /> Social Profiles ({data.osint.social_profiles?.length || 0})
                  </h4>
                  {data.osint.social_profiles?.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside max-h-48 overflow-y-auto">
                      {data.osint.social_profiles.map((s: string) => (
                        <li key={s}>
                          <a href={s} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                            {s}
                          </a>
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
                    <ul className="space-y-1 list-disc list-inside">
                      {data.osint.internal_ips.map((ip: string) => (
                        <li key={ip} className="text-sm text-gray-700 dark:text-gray-300 font-mono">{ip}</li>
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
                        <div key={e} className="text-xs font-mono text-gray-600 dark:text-gray-400">{e}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No endpoints found</p>
                  )}
                </div>
              </div>

              {/* Interesting Comments - Full section */}
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
