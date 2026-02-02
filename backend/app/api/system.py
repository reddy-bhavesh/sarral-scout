from fastapi import APIRouter, Depends
from app.services.tools import get_tool_runner
from app.api.deps import get_current_user
from app.models.user import UserResponse
from app.core.config import settings

router = APIRouter()

@router.get("/status")
async def check_system_status(current_user: UserResponse = Depends(get_current_user)):
    """Check system status based on execution mode."""
    execution_mode = settings.EXECUTION_MODE.lower()
    
    if execution_mode == "local":
        # In local mode, tools run inside the container
        tool_runner = get_tool_runner()
        # Test by running a simple command
        try:
            result = await tool_runner.run_command("echo 'tools ready'", timeout=5)
            is_ready = result.get("exit_code", 1) == 0
        except Exception:
            is_ready = False
        
        return {
            "execution_mode": "local",
            "tools_ready": is_ready,
            "message": "Tools running locally in container" if is_ready else "Local tools not available"
        }
    else:
        # In SSH mode, test connection to Kali VM
        tool_runner = get_tool_runner()
        ssh_status = await tool_runner.test_connection()
        return {
            "execution_mode": "ssh",
            "ssh_connection": ssh_status,
            "message": "Connected to Kali VM" if ssh_status else "Failed to connect to Kali VM"
        }
