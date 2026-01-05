from openai import AsyncOpenAI
from app.core.config import settings
import json
import re
import sys


class DatabricksAnalyzer:
    """
    AI Analyzer using Databricks-hosted Gemini model via OpenAI-compatible API.
    Primary analyzer with same interface as GeminiAnalyzer for easy fallback.
    """
    
    def __init__(self):
        if settings.DATABRICKS_API_KEY and settings.DATABRICKS_API_BASE:
            self.client = AsyncOpenAI(
                api_key=settings.DATABRICKS_API_KEY,
                base_url=settings.DATABRICKS_API_BASE
            )
            self.model = settings.DATABRICKS_MODEL
            print(f"DatabricksAnalyzer initialized with model: {self.model}", file=sys.stderr)
        else:
            self.client = None
            print("Warning: Databricks credentials not set. DatabricksAnalyzer disabled.", file=sys.stderr)

    def _system_prompt(self):
        """Same system prompt as GeminiAnalyzer for consistency."""
        return """
You are a cybersecurity analysis engine. 
Your outputs must be deterministic, consistent, and follow the required schema.

Rules:
1. ALWAYS output valid JSON.
2. NEVER add backticks, markdown, filler text, or explanations.
3. DO NOT invent vulnerabilities.
4. DO NOT duplicate similar findings. If similar, group them.
5. USE EXACT FIELD NAMES from the schema.
6. USE OWASP Top 10 and CWE identifiers where applicable.
7. SEVERITY MUST FOLLOW THESE RULES:

   Critical:
     - RCE, SQLi, Command Injection, Auth Bypass, Server Takeover
     - Full database compromise
     - Critical misconfigurations allowing full access

   High:
     - Sensitive Data Exposure
     - Privilege Escalation
     - Open admin panels
     - Broken access control
     - Major security header missing with real risk

   Medium:
     - Outdated software
     - Missing non-critical headers
     - Misconfigurations with moderate exploitation
     - Directory listing
     - Information leak

   Low:
     - Minor info leak
     - Fingerprinting
     - Deprecated technologies
     - Low-risk configuration warnings

   Info:
     - Noise, no real risk
     - Banner information
     - Technology enumeration

8. Severity = highest applicable category.
9. All findings must include OWASP + CWE mapping.
10. Format MUST follow schema.
        """

    def _sanitize_raw(self, raw_output: dict) -> str:
        """Reduce noise: remove timestamps, long logs, repeated patterns."""
        text = json.dumps(raw_output, indent=2)

        # Remove timestamps
        text = re.sub(r"\d{4}-\d{2}-\d{2}T.*?Z", "<timestamp>", text)
        text = re.sub(r"\d{2}:\d{2}:\d{2}", "<time>", text)

        # Collapse repeated lines
        lines = text.split("\n")
        cleaned = []
        for line in lines:
            if not cleaned or cleaned[-1] != line:
                cleaned.append(line)

        result = "\n".join(cleaned)
        
        # Truncate if too long (50k chars to be safe)
        if len(result) > 50000:
            result = result[:50000] + "\n...[TRUNCATED DUE TO LENGTH]..."
            
        return result

    async def analyze_phase(self, phase: str, raw_output: dict) -> dict:
        """
        Analyze phase output using Databricks Gemini.
        Returns same format as GeminiAnalyzer for compatibility.
        """
        if not self.client:
            raise RuntimeError("Databricks client not initialized")

        sanitized_raw = self._sanitize_raw(raw_output)
        print(f"DEBUG: Sending {len(sanitized_raw)} chars to Databricks for analysis", file=sys.stderr)

        user_prompt = f"""
Analyze the following scan output for the phase: {phase}

Raw Output (sanitized):
{sanitized_raw}

TASK:
Return a JSON object with EXACTLY:

{{
  "summary": "Detailed executive summary (approx 6-8 lines) covering key risks and findings",
  "vulnerabilities": [
    {{
      "Vulnerability": "Exact name",
      "Tool": "Tool name that found this",
      "Heading": "3-5 word short tag",
      "Severity": "Critical | High | Medium | Low | Info",
      "Likelihood": "High | Medium | Low",
      "Impact": "High | Medium | Low",
      "Description": "Detailed technical explanation",
      "Remediation": "Actionable remediation steps",
      "OWASP": "A01-Broken Access Control",
      "CWE": "CWE-200",
      "Evidence": "Specific log evidence included"
    }}
  ]
}}

STRICT RULES:
- MUST be pure JSON.
- MUST follow the schema exactly.
- MUST group similar issues.
- MUST use OWASP + CWE.
- MUST identify the Tool from the input keys.
- NO markdown or commentary.
"""

        # Retry loop
        for attempt in range(3):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self._system_prompt()},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.0,
                    max_tokens=4096
                )

                text = response.choices[0].message.content.strip()

                # Remove code fences if present
                if text.startswith("```"):
                    text = text.replace("```json", "").replace("```", "").strip()

                result = json.loads(text)

                # Validate schema
                if "summary" in result and "vulnerabilities" in result:
                    print(f"DEBUG: Databricks analysis successful", file=sys.stderr)
                    return result

            except Exception as e:
                print(f"[Databricks Analyzer Warning] Attempt {attempt+1} failed: {e}", file=sys.stderr)
                import asyncio
                await asyncio.sleep(2)

        # All retries failed - raise exception to trigger fallback
        raise RuntimeError("Databricks analysis failed after 3 attempts")
