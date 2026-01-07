import httpx
import asyncio
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class BreachChecker:
    """
    Service to check email breaches using XposedOrNot API.
    Free API with 1 request/second rate limit.
    """
    
    BASE_URL = "https://api.xposedornot.com/v1"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self._last_request_time = 0
    
    async def _rate_limit(self):
        """Ensure we don't exceed 1 request per second"""
        import time
        current_time = time.time()
        time_since_last = current_time - self._last_request_time
        if time_since_last < 1.0:
            await asyncio.sleep(1.0 - time_since_last)
        self._last_request_time = time.time()
    
    async def check_email(self, email: str) -> Dict[str, Any]:
        """
        Quick check if email has been in any breaches.
        Returns list of breach names.
        """
        await self._rate_limit()
        
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/check-email/{email}"
            )
            
            if response.status_code == 404:
                # Not found = not breached
                return {
                    "email": email,
                    "found": False,
                    "breaches": [],
                    "breach_count": 0
                }
            
            response.raise_for_status()
            data = response.json()
            
            # XposedOrNot returns breaches as nested list
            breaches = []
            if "breaches" in data and data["breaches"]:
                # Flatten the nested list
                for breach_list in data["breaches"]:
                    if isinstance(breach_list, list):
                        breaches.extend(breach_list)
                    else:
                        breaches.append(breach_list)
            
            return {
                "email": email,
                "found": len(breaches) > 0,
                "breaches": breaches,
                "breach_count": len(breaches)
            }
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error checking email {email}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error checking email {email}: {e}")
            raise
    
    async def get_breach_analytics(self, email: str) -> Dict[str, Any]:
        """
        Get detailed breach analytics for an email.
        First checks if breaches exist, then gets analytics.
        Returns risk score, exposed data types, breach details.
        """
        # First, do a quick check to get the breach list
        quick_check = await self.check_email(email)
        
        if not quick_check["found"]:
            return {
                "email": email,
                "found": False,
                "summary": None,
                "exposed_breaches": [],
                "risk": None,
                "exposed_data_types": [],
                "pastes_count": 0
            }
        
        # Rate limit before analytics call
        await self._rate_limit()
        
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/breach-analytics",
                params={"email": email}
            )
            
            if response.status_code == 404:
                # Analytics not found but we know breaches exist
                # Return basic info from check_email
                return {
                    "email": email,
                    "found": True,
                    "summary": {"breaches": quick_check["breaches"]},
                    "exposed_breaches": [{"breach": name, "domain": None, "industry": None, 
                                         "xposed_date": None, "xposed_records": None, 
                                         "xposed_data": None, "details": None, 
                                         "password_risk": None, "verified": None, "logo": None} 
                                        for name in quick_check["breaches"]],
                    "risk": None,
                    "exposed_data_types": [],
                    "pastes_count": 0
                }
            
            response.raise_for_status()
            data = response.json()
            
            logger.info(f"Analytics response keys: {data.keys()}")
            
            # Parse risk info
            risk = None
            if "BreachMetrics" in data and "risk" in data["BreachMetrics"]:
                risk_data = data["BreachMetrics"]["risk"]
                if risk_data and len(risk_data) > 0:
                    risk = {
                        "risk_score": risk_data[0].get("risk_score", 0),
                        "risk_label": risk_data[0].get("risk_label", "Unknown")
                    }
            
            # Parse exposed breaches - check multiple possible structures
            exposed_breaches = []
            
            # Try ExposedBreaches.breaches_details first
            if "ExposedBreaches" in data:
                exposed_data = data["ExposedBreaches"]
                if isinstance(exposed_data, dict) and "breaches_details" in exposed_data:
                    for breach in exposed_data["breaches_details"]:
                        exposed_breaches.append({
                            "breach": breach.get("breach", ""),
                            "domain": breach.get("domain"),
                            "industry": breach.get("industry"),
                            "xposed_date": breach.get("xposed_date"),
                            "xposed_records": breach.get("xposed_records"),
                            "xposed_data": breach.get("xposed_data"),
                            "details": breach.get("details"),
                            "password_risk": breach.get("password_risk"),
                            "verified": breach.get("verified"),
                            "logo": breach.get("logo")
                        })
            
            # If no detailed breaches found, create entries from quick_check
            if not exposed_breaches and quick_check["breaches"]:
                for breach_name in quick_check["breaches"]:
                    exposed_breaches.append({
                        "breach": breach_name,
                        "domain": None,
                        "industry": None,
                        "xposed_date": None,
                        "xposed_records": None,
                        "xposed_data": None,
                        "details": None,
                        "password_risk": None,
                        "verified": None,
                        "logo": None
                    })
            
            # Parse exposed data types
            exposed_data_types = []
            if "BreachMetrics" in data and "xposed_data" in data["BreachMetrics"]:
                xposed_data = data["BreachMetrics"]["xposed_data"]
                if xposed_data and len(xposed_data) > 0:
                    # Extract data type names from nested structure
                    for category in xposed_data[0].get("children", []):
                        for item in category.get("children", []):
                            name = item.get("name", "")
                            # Remove "data_" prefix
                            if name.startswith("data_"):
                                name = name[5:]
                            if name:
                                exposed_data_types.append(name)
            
            # Pastes count
            pastes_count = 0
            if "PastesSummary" in data and data["PastesSummary"]:
                pastes_count = data["PastesSummary"].get("cnt", 0)
            
            # Parse yearly breakdown
            yearly_breakdown = {}
            if "BreachMetrics" in data and "yearwise_details" in data["BreachMetrics"]:
                yearwise = data["BreachMetrics"]["yearwise_details"]
                if yearwise and len(yearwise) > 0:
                    for key, value in yearwise[0].items():
                        # Convert y2020 -> 2020
                        if key.startswith("y"):
                            year = key[1:]
                            yearly_breakdown[year] = value
            
            # Parse password strength breakdown
            password_strength = None
            if "BreachMetrics" in data and "passwords_strength" in data["BreachMetrics"]:
                pw_data = data["BreachMetrics"]["passwords_strength"]
                if pw_data and len(pw_data) > 0:
                    password_strength = {
                        "plain_text": pw_data[0].get("PlainText", 0),
                        "easy_to_crack": pw_data[0].get("EasyToCrack", 0),
                        "strong_hash": pw_data[0].get("StrongHash", 0),
                        "unknown": pw_data[0].get("Unknown", 0)
                    }
            
            # Parse industry breakdown
            industry_breakdown = {}
            if "BreachMetrics" in data and "industry" in data["BreachMetrics"]:
                industry_data = data["BreachMetrics"]["industry"]
                if industry_data and len(industry_data) > 0:
                    # Industry codes to full names mapping
                    industry_names = {
                        "elec": "Electronics", "misc": "Miscellaneous", "mini": "Mining",
                        "musi": "Music", "manu": "Manufacturing", "ener": "Energy",
                        "news": "News", "ente": "Entertainment", "hosp": "Hospitality",
                        "heal": "Healthcare", "food": "Food", "phar": "Pharmaceutical",
                        "educ": "Education", "cons": "Construction", "agri": "Agriculture",
                        "tele": "Telecom", "info": "Information Technology", 
                        "tran": "Transport", "aero": "Aerospace", "fina": "Finance",
                        "reta": "Retail", "nonp": "Non-Profit", "govt": "Government",
                        "spor": "Sports", "envi": "Environment"
                    }
                    for item in industry_data[0]:
                        if isinstance(item, list) and len(item) == 2:
                            code, count = item
                            if count > 0:
                                name = industry_names.get(code, code.title())
                                industry_breakdown[name] = count
            
            # Determine found based on breaches from quick_check
            found = quick_check["found"] or len(exposed_breaches) > 0
            
            return {
                "email": email,
                "found": found,
                "summary": data.get("BreachesSummary"),
                "exposed_breaches": exposed_breaches,
                "risk": risk,
                "exposed_data_types": exposed_data_types,
                "pastes_count": pastes_count,
                "yearly_breakdown": yearly_breakdown,
                "password_strength": password_strength,
                "industry_breakdown": industry_breakdown
            }
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting analytics for {email}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting analytics for {email}: {e}")
            raise
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
