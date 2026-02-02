"""
Tool execution module supporting both local (container) and SSH (remote Kali) execution.
The execution mode is controlled by the EXECUTION_MODE setting in config.py.
"""

import asyncio
import os
import shutil
from typing import Callable, Optional, Awaitable
from app.core.config import settings


class LocalToolRunner:
    """
    Executes security tools locally using asyncio subprocess.
    Used when running in containerized mode (EXECUTION_MODE=local).
    """
    
    async def run_command(
        self, 
        command: str, 
        output_callback: Optional[Callable[[str], Awaitable[None]]] = None, 
        timeout: Optional[int] = None
    ) -> dict:
        """Execute a command locally and stream output."""
        try:
            full_stdout = ""
            
            async def _execute():
                nonlocal full_stdout
                
                # Create subprocess with larger buffer limits
                process = await asyncio.create_subprocess_shell(
                    command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd="/tmp",  # Default working directory
                    limit=10 * 1024 * 1024  # 10MB buffer limit for large outputs
                )
                
                async def read_stream(stream, callback):
                    """Read stream in chunks to handle large outputs like JSON."""
                    nonlocal full_stdout
                    buffer = ""
                    while True:
                        try:
                            # Read in chunks instead of readline to avoid line length limits
                            chunk = await stream.read(64 * 1024)  # 64KB chunks
                            if not chunk:
                                break
                            decoded = chunk.decode('utf-8', errors='replace')
                            full_stdout += decoded
                            buffer += decoded
                            
                            # Stream output line by line for real-time feedback
                            if callback:
                                while '\n' in buffer:
                                    line, buffer = buffer.split('\n', 1)
                                    await callback(line)
                        except Exception as e:
                            print(f"Stream read error: {e}")
                            break
                    
                    # Handle any remaining buffer content
                    if buffer and callback:
                        await callback(buffer)
                
                # Read stdout and stderr concurrently
                await asyncio.gather(
                    read_stream(process.stdout, output_callback),
                    read_stream(process.stderr, output_callback)
                )
                
                await process.wait()
                return process.returncode
            
            if timeout:
                try:
                    exit_code = await asyncio.wait_for(_execute(), timeout=timeout)
                except asyncio.TimeoutError:
                    return {
                        "error": "Command timed out", 
                        "output": full_stdout + "\n[System] Command timed out.", 
                        "exit_code": -1
                    }
            else:
                exit_code = await _execute()
            
            return {
                "output": full_stdout,
                "exit_code": exit_code if exit_code is not None else -1
            }
            
        except Exception as e:
            print(f"Local Execution Error: {e}")
            return {"error": f"Execution Error: {str(e)}", "output": "", "exit_code": -1}
    
    async def create_dir(self, path: str) -> bool:
        """Create a directory locally."""
        try:
            os.makedirs(path, exist_ok=True)
            return True
        except Exception as e:
            print(f"Create Dir Error: {e}")
            return False
    
    async def remove_dir(self, path: str) -> bool:
        """Remove a directory locally."""
        try:
            # Safety check
            if path == "/" or path == "" or ".." in path:
                print(f"Safety check failed for removing dir: {path}")
                return False
            if os.path.exists(path):
                shutil.rmtree(path)
            return True
        except Exception as e:
            print(f"Remove Dir Error: {e}")
            return False
    
    async def file_exists(self, path: str) -> bool:
        """Check if a file exists locally."""
        return os.path.isfile(path)
    
    async def upload_file(self, local_path: str, remote_path: str) -> bool:
        """
        Copy a file locally (simulates upload for local mode).
        In local mode, this just copies the file to the destination.
        """
        try:
            # In local mode, if source and dest are same, no-op
            if os.path.abspath(local_path) == os.path.abspath(remote_path):
                return True
            
            os.makedirs(os.path.dirname(remote_path), exist_ok=True)
            shutil.copy2(local_path, remote_path)
            return True
        except Exception as e:
            print(f"File Copy Error: {e}")
            return False
    
    async def test_connection(self) -> bool:
        """Test local execution capability."""
        try:
            result = await self.run_command("echo 'test'", timeout=5)
            return result.get("exit_code") == 0
        except Exception:
            return False


class SSHClient:
    """
    Executes security tools on a remote Kali machine via SSH.
    Used when EXECUTION_MODE=ssh.
    """
    
    def __init__(self):
        self.host = settings.KALI_HOST
        self.port = settings.KALI_PORT
        self.username = settings.KALI_USER
        self.password = settings.KALI_PASSWORD
        self.client_keys = [settings.KALI_KEY_PATH] if settings.KALI_KEY_PATH else None

    async def run_command(
        self, 
        command: str, 
        output_callback: Optional[Callable[[str], Awaitable[None]]] = None, 
        timeout: Optional[int] = None
    ) -> dict:
        """Execute a command via SSH and stream output."""
        import asyncssh
        
        try:
            async with asyncssh.connect(
                self.host, port=self.port, username=self.username, 
                password=self.password, client_keys=self.client_keys,
                known_hosts=None
            ) as conn:
                full_stdout = ""
                
                async def _execute():
                    nonlocal full_stdout
                    async with conn.create_process(command) as process:
                        async def read_stream(stream, callback):
                            nonlocal full_stdout
                            async for line in stream:
                                full_stdout += line
                                if callback:
                                    await callback(line)

                        await asyncio.gather(
                            read_stream(process.stdout, output_callback),
                            read_stream(process.stderr, output_callback)
                        )
                        
                    return process.exit_status

                if timeout:
                    try:
                        exit_code = await asyncio.wait_for(_execute(), timeout=timeout)
                    except asyncio.TimeoutError:
                        return {
                            "error": "Command timed out", 
                            "output": full_stdout + "\n[System] Command timed out.", 
                            "exit_code": -1
                        }
                else:
                    exit_code = await _execute()

                return {
                    "output": full_stdout,
                    "exit_code": exit_code
                }

        except Exception as e:
            print(f"SSH Error: {e}")
            return {"error": f"SSH Error: {str(e)}", "output": "", "exit_code": -1}

    async def create_dir(self, remote_path: str) -> bool:
        """Create a directory on the remote server."""
        import asyncssh
        
        try:
            async with asyncssh.connect(
                self.host, port=self.port, username=self.username, 
                password=self.password, client_keys=self.client_keys,
                known_hosts=None
            ) as conn:
                await conn.run(f"mkdir -p {remote_path}", check=True)
                return True
        except Exception as e:
            print(f"SSH Create Dir Error: {e}")
            return False

    async def remove_dir(self, remote_path: str) -> bool:
        """Remove a directory on the remote server."""
        import asyncssh
        
        try:
            async with asyncssh.connect(
                self.host, port=self.port, username=self.username, 
                password=self.password, client_keys=self.client_keys,
                known_hosts=None
            ) as conn:
                if remote_path == "/" or remote_path == "" or ".." in remote_path:
                    print(f"Safety check failed for removing dir: {remote_path}")
                    return False
                await conn.run(f"rm -rf {remote_path}", check=True)
                return True
        except Exception as e:
            print(f"SSH Remove Dir Error: {e}")
            return False

    async def file_exists(self, remote_path: str) -> bool:
        """Check if a file exists on the remote server."""
        import asyncssh
        
        try:
            async with asyncssh.connect(
                self.host, port=self.port, username=self.username, 
                password=self.password, client_keys=self.client_keys,
                known_hosts=None
            ) as conn:
                result = await conn.run(f"test -f {remote_path}", check=False)
                return result.exit_status == 0
        except Exception as e:
            print(f"SSH File Check Error: {e}")
            return False

    async def upload_file(self, local_path: str, remote_path: str) -> bool:
        """Upload a file to the remote server using SFTP."""
        import asyncssh
        import hashlib
        
        try:
            with open(local_path, "rb") as f:
                local_hash = hashlib.md5(f.read()).hexdigest()

            async with asyncssh.connect(
                self.host, port=self.port, username=self.username, 
                password=self.password, client_keys=self.client_keys,
                known_hosts=None
            ) as conn:
                exists_result = await conn.run(
                    f"test -f {remote_path} && md5sum {remote_path} | awk '{{print $1}}'", 
                    check=False
                )
                if exists_result.exit_status == 0:
                    remote_hash = exists_result.stdout.strip()
                    if local_hash == remote_hash:
                        return True

                async with conn.start_sftp_client() as sftp:
                    await sftp.put(local_path, remote_path)
                
                await conn.run(f"chmod +x {remote_path}", check=True)
                return True

        except Exception as e:
            print(f"SSH Upload Error: {e}")
            return False

    async def test_connection(self) -> bool:
        """Test SSH connection to the remote server."""
        import asyncssh
        
        try:
            async with asyncssh.connect(
                self.host, port=self.port, username=self.username, 
                password=self.password, client_keys=self.client_keys,
                known_hosts=None, connect_timeout=5
            ) as conn:
                await conn.run("echo 'test'", check=True)
                return True
        except Exception as e:
            print(f"SSH Test Connection Failed: {e}")
            return False


def get_tool_runner():
    """
    Factory function to get the appropriate tool runner based on EXECUTION_MODE.
    Returns LocalToolRunner for container mode, SSHClient for SSH mode.
    """
    if settings.EXECUTION_MODE.lower() == "local":
        return LocalToolRunner()
    else:
        return SSHClient()
