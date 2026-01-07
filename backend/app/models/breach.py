from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any


class BreachCheckResponse(BaseModel):
    """Response for quick email breach check"""
    email: str
    found: bool
    breaches: List[str]
    breach_count: int


class ExposedBreachDetail(BaseModel):
    """Details about a specific breach"""
    breach: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    xposed_date: Optional[str] = None
    xposed_records: Optional[int] = None
    xposed_data: Optional[str] = None
    details: Optional[str] = None
    password_risk: Optional[str] = None
    verified: Optional[str] = None
    logo: Optional[str] = None


class RiskInfo(BaseModel):
    """Risk assessment information"""
    risk_score: int
    risk_label: str


class PasswordStrength(BaseModel):
    """Password security breakdown"""
    plain_text: int = 0
    easy_to_crack: int = 0
    strong_hash: int = 0
    unknown: int = 0


class BreachAnalyticsResponse(BaseModel):
    """Response for detailed breach analytics"""
    email: str
    found: bool
    summary: Optional[Dict[str, Any]] = None
    exposed_breaches: Optional[List[ExposedBreachDetail]] = None
    risk: Optional[RiskInfo] = None
    exposed_data_types: Optional[List[str]] = None
    pastes_count: Optional[int] = None
    yearly_breakdown: Optional[Dict[str, int]] = None
    password_strength: Optional[PasswordStrength] = None
    industry_breakdown: Optional[Dict[str, int]] = None
    error: Optional[str] = None
