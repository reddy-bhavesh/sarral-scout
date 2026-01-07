from fastapi import APIRouter, HTTPException
from pydantic import EmailStr
from app.services.breach_checker import BreachChecker
from app.models.breach import BreachCheckResponse, BreachAnalyticsResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Shared instance with rate limiting
breach_checker = BreachChecker()


@router.get("/check-email/{email}", response_model=BreachCheckResponse)
async def check_email_breaches(email: str):
    """
    Check if an email address has been exposed in any known data breaches.
    Returns a list of breach names if found.
    """
    try:
        result = await breach_checker.check_email(email)
        return BreachCheckResponse(**result)
    except Exception as e:
        logger.error(f"Error checking email breaches: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check email: {str(e)}")


@router.get("/analytics/{email}", response_model=BreachAnalyticsResponse)
async def get_breach_analytics(email: str):
    """
    Get detailed breach analytics for an email address.
    Returns risk score, exposed data types, and breach details.
    """
    try:
        result = await breach_checker.get_breach_analytics(email)
        return BreachAnalyticsResponse(**result)
    except Exception as e:
        logger.error(f"Error getting breach analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")
