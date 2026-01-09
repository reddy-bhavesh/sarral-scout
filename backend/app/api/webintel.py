"""
Web Intelligence API Router
Provides endpoints for domain intelligence without running a full scan.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import asyncio
from dataclasses import asdict

from app.services.web_intel import (
    get_dns_records,
    get_dnssec_records,
    get_email_security,
    get_whois_info,
    get_ip_location,
    get_traceroute,
    check_ip_blacklist,
    get_full_intelligence
)
from app.core.scripts.webscraper_recon import WebScraperRecon
from app.api.deps import get_current_user

router = APIRouter()


class WebIntelRequest(BaseModel):
    target: str = Field(..., description="Domain or URL to analyze")
    mode: str = Field(default="full", description="'quick' for HTTP probe only, 'full' for complete analysis with crawl")
    dkim_selector: Optional[str] = Field(default="default", description="DKIM selector to check")


class WebIntelResponse(BaseModel):
    success: bool
    target: str
    data: Dict[str, Any]
    errors: list = []


@router.post("/analyze", response_model=WebIntelResponse)
async def analyze_target(
    request: WebIntelRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze a domain/URL and return comprehensive web intelligence.
    
    Includes:
    - DNS records (A, AAAA, MX, NS, TXT, CNAME, SOA)
    - DNSSEC status
    - Email security (SPF, DMARC, DKIM)
    - WHOIS information
    - IP geolocation
    - HTTP probe (status, headers, technologies, WAF)
    - TLS/SSL certificate info
    - Security headers
    - Traceroute
    - IP blacklist check
    - OSINT data (emails, phones, social links) - in full mode
    """
    target = request.target.strip()
    if not target:
        raise HTTPException(status_code=400, detail="Target is required")
    
    errors = []
    result_data = {}
    
    # Normalize target (remove protocol for domain operations)
    domain = target.lower()
    if domain.startswith('http://') or domain.startswith('https://'):
        from urllib.parse import urlparse
        domain = urlparse(domain).hostname or domain
    
    # 1. DNS Intelligence (runs in executor to not block)
    loop = asyncio.get_event_loop()
    
    try:
        dns_result = await loop.run_in_executor(None, get_full_intelligence, domain)
        result_data['dns_records'] = dns_result.get('dns_records', {})
        result_data['dnssec'] = dns_result.get('dnssec', {})
        result_data['email_security'] = dns_result.get('email_security', {})
        result_data['whois'] = dns_result.get('whois', {})
        result_data['ip_location'] = dns_result.get('ip_location', {})
        result_data['traceroute'] = dns_result.get('traceroute', {})
        result_data['blacklist'] = dns_result.get('blacklist', {})
        errors.extend(dns_result.get('errors', []))
    except Exception as e:
        errors.append(f"DNS Intelligence failed: {str(e)}")
    
    # 2. Web Probe (using webscraper_recon)
    try:
        scraper = WebScraperRecon(
            base_url=target,
            max_pages=20 if request.mode == "full" else 1,
            max_depth=1 if request.mode == "full" else 0,
            timeout=10,
            verify_tls=True,
            only_dns=False,
            probe_web=request.mode == "quick"
        )
        
        # Run crawl in executor
        scrape_result = await loop.run_in_executor(None, scraper.crawl)
        scrape_data = asdict(scrape_result)
        
        # Merge web data
        result_data['http_probe'] = scrape_data.get('http_probe', {})
        result_data['resolved_ips'] = scrape_data.get('resolved_ips', [])
        result_data['tls_info'] = scrape_data.get('tls_info', {})
        result_data['headers'] = scrape_data.get('headers', {})
        result_data['security_headers'] = scrape_data.get('security_headers', {})
        result_data['technologies'] = scrape_data.get('technologies', [])
        result_data['waf'] = scrape_data.get('waf', '')
        result_data['http_methods'] = scrape_data.get('http_methods', [])
        result_data['favicon_hash'] = scrape_data.get('favicon_hash', {})
        result_data['alive'] = scrape_data.get('alive', False)
        
        # OSINT  data (only in full mode)
        if request.mode == "full":
            result_data['osint'] = {
                'emails': scrape_data.get('emails', []),
                'phones': scrape_data.get('phones', []),
                'social_profiles': scrape_data.get('social_profiles', []),
                'api_endpoints': scrape_data.get('api_endpoints', []),
                'internal_ips': scrape_data.get('internal_ips', []),
                'comments': scrape_data.get('comments', []),
            }
            result_data['crawl_stats'] = {
                'pages_visited': scrape_data.get('pages_visited', 0),
                'visited_urls': scrape_data.get('visited_urls', []),
                'duration_sec': scrape_data.get('duration_sec', 0)
            }
        
        errors.extend(scrape_data.get('errors', []))
        
    except Exception as e:
        errors.append(f"Web probe failed: {str(e)}")
    
    return WebIntelResponse(
        success=len(errors) == 0 or 'http_probe' in result_data,
        target=domain,
        data=result_data,
        errors=errors
    )


@router.get("/dns/{domain}")
async def get_domain_dns(
    domain: str,
    current_user: dict = Depends(get_current_user)
):
    """Quick DNS record lookup for a domain."""
    loop = asyncio.get_event_loop()
    records = await loop.run_in_executor(None, get_dns_records, domain)
    return {"domain": domain, "records": records}


@router.get("/whois/{domain}")
async def get_domain_whois(
    domain: str,
    current_user: dict = Depends(get_current_user)
):
    """Quick WHOIS lookup for a domain."""
    loop = asyncio.get_event_loop()
    info = await loop.run_in_executor(None, get_whois_info, domain)
    return {"domain": domain, "whois": info}


@router.get("/email-security/{domain}")
async def get_domain_email_security(
    domain: str,
    current_user: dict = Depends(get_current_user)
):
    """Check SPF, DMARC, and DKIM for a domain."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, get_email_security, domain)
    return {"domain": domain, "email_security": result}


@router.get("/blacklist/{ip}")
async def check_blacklist(
    ip: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if an IP is listed in spam blacklists."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, check_ip_blacklist, ip)
    return result


# ============ History Endpoints ============

@router.get("/history")
async def get_history(
    current_user: dict = Depends(get_current_user)
):
    """Get the user's recent web intelligence searches (last 10)."""
    from prisma import Prisma
    
    db = Prisma()
    await db.connect()
    
    try:
        history = await db.webintelhistory.find_many(
            where={"userId": current_user.id},
            order={"createdAt": "desc"},
            take=10
        )
        return {
            "history": [
                {
                    "id": h.id,
                    "target": h.target,
                    "mode": h.mode,
                    "createdAt": h.createdAt.isoformat()
                }
                for h in history
            ]
        }
    finally:
        await db.disconnect()


@router.post("/history")
async def save_history(
    target: str,
    mode: str = "quick",
    current_user: dict = Depends(get_current_user)
):
    """Save a search to the user's history."""
    from prisma import Prisma
    
    db = Prisma()
    await db.connect()
    
    try:
        # Check if this target already exists for user - if so, update timestamp
        existing = await db.webintelhistory.find_first(
            where={
                "userId": current_user.id,
                "target": target
            }
        )
        
        if existing:
            # Update the existing entry with new timestamp and mode
            from datetime import datetime
            await db.webintelhistory.update(
                where={"id": existing.id},
                data={"mode": mode, "createdAt": datetime.now()}
            )
        else:
            # Create new entry
            await db.webintelhistory.create(
                data={
                    "userId": current_user.id,
                    "target": target,
                    "mode": mode
                }
            )
        
        # Keep only last 10 entries for this user
        all_history = await db.webintelhistory.find_many(
            where={"userId": current_user.id},
            order={"createdAt": "desc"}
        )
        
        if len(all_history) > 10:
            old_ids = [h.id for h in all_history[10:]]
            await db.webintelhistory.delete_many(
                where={"id": {"in": old_ids}}
            )
        
        return {"success": True}
    finally:
        await db.disconnect()


@router.delete("/history")
async def clear_history(
    current_user: dict = Depends(get_current_user)
):
    """Clear all search history for the user."""
    from prisma import Prisma
    
    db = Prisma()
    await db.connect()
    
    try:
        await db.webintelhistory.delete_many(
            where={"userId": current_user.id}
        )
        return {"success": True}
    finally:
        await db.disconnect()

