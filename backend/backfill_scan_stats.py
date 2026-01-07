"""
Script to backfill duration_seconds and vulnerability counts for existing scans.
Run this once to update historical scans that were created before these fields were added.
"""
import asyncio
import json
from datetime import timezone
from prisma import Prisma

async def backfill_scan_stats():
    db = Prisma()
    await db.connect()
    
    try:
        # Get all scans
        scans = await db.scan.find_many(
            include={"results": True}
        )
        
        print(f"Found {len(scans)} scans to process...")
        
        for scan in scans:
            # Calculate duration
            if scan.results:
                end_times = [r.finished_at for r in scan.results if r.finished_at]
                start_times = [r.started_at for r in scan.results if r.started_at]
                
                if end_times and start_times:
                    end = max(end_times)
                    start = min(start_times)
                    duration = int((end - start).total_seconds())
                else:
                    duration = 0
            else:
                duration = 0
            
            # Calculate vulnerability counts
            critical_c = 0
            high_c = 0
            medium_c = 0
            low_c = 0
            info_c = 0
            
            if scan.results:
                for res in scan.results:
                    if res.gemini_summary:
                        try:
                            summary_data = json.loads(res.gemini_summary)
                            if "vulnerabilities" in summary_data:
                                for v in summary_data["vulnerabilities"]:
                                    sev = v.get("Severity", "Info").lower()
                                    if sev == "critical": critical_c += 1
                                    elif sev == "high": high_c += 1
                                    elif sev == "medium": medium_c += 1
                                    elif sev == "low": low_c += 1
                                    else: info_c += 1
                        except:
                            pass
            
            # Update scan
            await db.scan.update(
                where={"id": scan.id},
                data={
                    "duration_seconds": duration,
                    "critical_count": critical_c,
                    "high_count": high_c,
                    "medium_count": medium_c,
                    "low_count": low_c,
                    "info_count": info_c
                }
            )
            
            print(f"Updated scan #{scan.id}: duration={duration}s, C={critical_c}, H={high_c}, M={medium_c}, L={low_c}, I={info_c}")
        
        print("\nBackfill complete!")
        
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(backfill_scan_stats())
