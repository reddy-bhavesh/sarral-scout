"""
Web Intelligence Service
Provides domain intelligence features: DNS records, WHOIS, SPF/DMARC/DKIM, 
IP location, DNSSEC, Traceroute, IP Blacklist checks.
"""
import socket
import ssl
import subprocess
import hashlib
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

import dns.resolver
import dns.rdatatype
import whois
import httpx
import requests
from bs4 import BeautifulSoup


# ============ DNS Records ============

def get_dns_records(domain: str) -> Dict[str, Any]:
    """Get all DNS record types for a domain."""
    records = {}
    record_types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA']
    
    resolver = dns.resolver.Resolver()
    resolver.timeout = 5
    resolver.lifetime = 10
    
    for rtype in record_types:
        try:
            answers = resolver.resolve(domain, rtype)
            if rtype == 'MX':
                records[rtype] = [{'priority': r.preference, 'host': str(r.exchange)} for r in answers]
            elif rtype == 'SOA':
                soa = answers[0]
                records[rtype] = {
                    'mname': str(soa.mname),
                    'rname': str(soa.rname),
                    'serial': soa.serial,
                    'refresh': soa.refresh,
                    'retry': soa.retry,
                    'expire': soa.expire,
                    'minimum': soa.minimum
                }
            else:
                records[rtype] = [str(r) for r in answers]
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers, dns.exception.Timeout):
            records[rtype] = []
        except Exception as e:
            records[rtype] = []
    
    return records


# ============ DNSSEC ============

def get_dnssec_records(domain: str) -> Dict[str, Any]:
    """Get DNSKEY and DS records for DNSSEC validation."""
    dnssec = {'enabled': False, 'dnskey': [], 'ds': []}
    resolver = dns.resolver.Resolver()
    
    try:
        # DNSKEY
        dnskey_answers = resolver.resolve(domain, 'DNSKEY')
        dnssec['dnskey'] = [str(r) for r in dnskey_answers]
        dnssec['enabled'] = True
    except:
        pass
    
    try:
        # DS record (usually at parent zone)
        ds_answers = resolver.resolve(domain, 'DS')
        dnssec['ds'] = [str(r) for r in ds_answers]
        dnssec['enabled'] = True
    except:
        pass
    
    return dnssec


# ============ SPF/DMARC/DKIM ============

def get_email_security(domain: str, dkim_selector: str = "default") -> Dict[str, Any]:
    """Get SPF, DMARC, and DKIM records."""
    result = {
        'spf': {'found': False, 'record': None, 'valid': False},
        'dmarc': {'found': False, 'record': None, 'policy': None},
        'dkim': {'found': False, 'record': None, 'selector': dkim_selector}
    }
    
    resolver = dns.resolver.Resolver()
    resolver.timeout = 5
    
    # SPF - look in TXT records
    try:
        txt_answers = resolver.resolve(domain, 'TXT')
        for txt in txt_answers:
            txt_str = str(txt).strip('"')
            if txt_str.startswith('v=spf1'):
                result['spf']['found'] = True
                result['spf']['record'] = txt_str
                result['spf']['valid'] = 'all' in txt_str or 'include:' in txt_str
                break
    except:
        pass
    
    # DMARC - query _dmarc.domain
    try:
        dmarc_answers = resolver.resolve(f'_dmarc.{domain}', 'TXT')
        for txt in dmarc_answers:
            txt_str = str(txt).strip('"')
            if txt_str.startswith('v=DMARC1'):
                result['dmarc']['found'] = True
                result['dmarc']['record'] = txt_str
                # Extract policy
                if 'p=reject' in txt_str:
                    result['dmarc']['policy'] = 'reject'
                elif 'p=quarantine' in txt_str:
                    result['dmarc']['policy'] = 'quarantine'
                elif 'p=none' in txt_str:
                    result['dmarc']['policy'] = 'none'
                break
    except:
        pass
    
    # DKIM - query selector._domainkey.domain
    for selector in [dkim_selector, 'default', 'google', 'selector1', 'selector2', 'k1']:
        try:
            dkim_answers = resolver.resolve(f'{selector}._domainkey.{domain}', 'TXT')
            for txt in dkim_answers:
                txt_str = str(txt).strip('"')
                if 'v=DKIM1' in txt_str or 'p=' in txt_str:
                    result['dkim']['found'] = True
                    result['dkim']['record'] = txt_str
                    result['dkim']['selector'] = selector
                    break
            if result['dkim']['found']:
                break
        except:
            continue
    
    return result


# ============ WHOIS ============

def get_whois_info(domain: str) -> Dict[str, Any]:
    """Get WHOIS information for a domain."""
    try:
        w = whois.whois(domain)
        
        # Handle list values
        def first_or_val(v):
            if isinstance(v, list):
                return v[0] if v else None
            return v
        
        # Format dates
        def format_date(d):
            if isinstance(d, list):
                d = d[0] if d else None
            if isinstance(d, datetime):
                return d.isoformat()
            return str(d) if d else None
        
        return {
            'found': True,
            'domain_name': first_or_val(w.domain_name),
            'registrar': first_or_val(w.registrar),
            'creation_date': format_date(w.creation_date),
            'expiration_date': format_date(w.expiration_date),
            'updated_date': format_date(w.updated_date),
            'name_servers': w.name_servers if isinstance(w.name_servers, list) else [w.name_servers] if w.name_servers else [],
            'status': w.status if isinstance(w.status, list) else [w.status] if w.status else [],
            'registrant': first_or_val(w.get('registrant_name') or w.get('org')),
            'country': first_or_val(w.get('registrant_country') or w.get('country')),
        }
    except Exception as e:
        return {'found': False, 'error': str(e)}


# ============ IP Location ============

def get_ip_location(ip: str) -> Dict[str, Any]:
    """Get geolocation info for an IP address."""
    try:
        # Using ip-api.com (free, no key needed)
        response = requests.get(f'http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,asname', timeout=5)
        data = response.json()
        
        if data.get('status') == 'success':
            return {
                'found': True,
                'ip': ip,
                'country': data.get('country'),
                'country_code': data.get('countryCode'),
                'region': data.get('regionName'),
                'city': data.get('city'),
                'zip': data.get('zip'),
                'lat': data.get('lat'),
                'lon': data.get('lon'),
                'isp': data.get('isp'),
                'org': data.get('org'),
                'asn': data.get('as'),
                'asn_name': data.get('asname')
            }
        return {'found': False, 'error': data.get('message', 'Unknown error')}
    except Exception as e:
        return {'found': False, 'error': str(e)}


# ============ Traceroute ============

def get_traceroute(target: str, max_hops: int = 15) -> Dict[str, Any]:
    """Perform a traceroute to the target."""
    hops = []
    
    try:
        # Windows uses tracert, Linux uses traceroute
        import platform
        if platform.system() == 'Windows':
            cmd = ['tracert', '-h', str(max_hops), '-w', '1000', target]
        else:
            cmd = ['traceroute', '-m', str(max_hops), '-w', '1', '-q', '1', target]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        output = result.stdout
        
        # Parse output
        lines = output.strip().split('\n')
        for line in lines[1:]:  # Skip header
            line = line.strip()
            if not line:
                continue
            
            # Try to extract hop info
            # Windows format: "  1    <1 ms    <1 ms    <1 ms  192.168.1.1"
            # Linux format: " 1  gateway (192.168.1.1)  0.5 ms"
            
            hop_match = re.match(r'\s*(\d+)\s+(.+)', line)
            if hop_match:
                hop_num = int(hop_match.group(1))
                rest = hop_match.group(2)
                
                # Extract IPs
                ip_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', rest)
                ip = ip_match.group(1) if ip_match else None
                
                # Extract time
                time_match = re.search(r'(\d+(?:\.\d+)?)\s*ms', rest)
                time_ms = float(time_match.group(1)) if time_match else None
                
                if ip or '*' in rest:
                    hops.append({
                        'hop': hop_num,
                        'ip': ip,
                        'time_ms': time_ms,
                        'timeout': '*' in rest and not ip
                    })
        
        return {'success': True, 'target': target, 'hops': hops}
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'Timeout', 'hops': hops}
    except Exception as e:
        return {'success': False, 'error': str(e), 'hops': []}


# ============ IP Blacklist Check ============

DNSBL_SERVERS = [
    'zen.spamhaus.org',
    'bl.spamcop.net',
    'b.barracudacentral.org',
    'dnsbl.sorbs.net',
    'spam.dnsbl.sorbs.net',
    'cbl.abuseat.org',
    'dnsbl-1.uceprotect.net',
    'psbl.surriel.com',
]

def check_ip_blacklist(ip: str) -> Dict[str, Any]:
    """Check if an IP is listed in common DNS blacklists."""
    results = []
    listed_count = 0
    
    # Reverse the IP for DNSBL query
    reversed_ip = '.'.join(reversed(ip.split('.')))
    
    resolver = dns.resolver.Resolver()
    resolver.timeout = 2
    resolver.lifetime = 3
    
    for dnsbl in DNSBL_SERVERS:
        query = f'{reversed_ip}.{dnsbl}'
        listed = False
        
        try:
            resolver.resolve(query, 'A')
            listed = True
            listed_count += 1
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
            listed = False
        except:
            listed = False
        
        results.append({
            'dnsbl': dnsbl,
            'listed': listed
        })
    
    return {
        'ip': ip,
        'total_checked': len(DNSBL_SERVERS),
        'listed_count': listed_count,
        'clean': listed_count == 0,
        'results': results
    }


# ============ Combined Intel Function ============

def get_full_intelligence(target: str) -> Dict[str, Any]:
    """Get comprehensive web intelligence for a target domain/IP."""
    
    # Normalize target
    target = target.strip().lower()
    if target.startswith('http://') or target.startswith('https://'):
        from urllib.parse import urlparse
        target = urlparse(target).hostname or target
    
    result = {
        'target': target,
        'timestamp': datetime.utcnow().isoformat(),
        'dns_records': {},
        'dnssec': {},
        'email_security': {},
        'whois': {},
        'ip_location': {},
        'traceroute': {},
        'blacklist': {},
        'errors': []
    }
    
    try:
        # DNS Records
        result['dns_records'] = get_dns_records(target)
    except Exception as e:
        result['errors'].append(f'DNS: {str(e)}')
    
    try:
        # DNSSEC
        result['dnssec'] = get_dnssec_records(target)
    except Exception as e:
        result['errors'].append(f'DNSSEC: {str(e)}')
    
    try:
        # Email Security
        result['email_security'] = get_email_security(target)
    except Exception as e:
        result['errors'].append(f'Email Security: {str(e)}')
    
    try:
        # WHOIS
        result['whois'] = get_whois_info(target)
    except Exception as e:
        result['errors'].append(f'WHOIS: {str(e)}')
    
    # Get first IP for location and blacklist
    first_ip = None
    if result['dns_records'].get('A'):
        first_ip = result['dns_records']['A'][0]
    
    if first_ip:
        try:
            result['ip_location'] = get_ip_location(first_ip)
        except Exception as e:
            result['errors'].append(f'IP Location: {str(e)}')
        
        try:
            result['blacklist'] = check_ip_blacklist(first_ip)
        except Exception as e:
            result['errors'].append(f'Blacklist: {str(e)}')
    
    try:
        # Traceroute
        result['traceroute'] = get_traceroute(target)
    except Exception as e:
        result['errors'].append(f'Traceroute: {str(e)}')
    
    return result
