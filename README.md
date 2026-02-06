# Scout - Advanced Vulnerability Scanner & Pentesting Platform

**Scout** is a comprehensive, automated penetration testing and vulnerability scanning platform designed to simplify security assessments. It combines powerful open-source security tools with modern AI analysis to provide real-time insights, detailed reports, and actionable remediation advice.

![Dashboard Preview](frontend/public/dashboard-preview.png)

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph Client["👤 Client"]
        Browser["Browser"]
    end

    subgraph Frontend["🖥️ Frontend - React + Vite"]
        UI["React UI"]
        MSAL["MSAL.js"]
        SSE["SSE Client"]
    end

    subgraph Backend["⚙️ Backend - FastAPI"]
        API["REST API"]
        Auth["Auth Service"]
        ScanMgr["Scan Manager"]
        WebIntel["Web Intelligence"]
        EventMgr["Event Manager - SSE"]
    end

    subgraph AI["🧠 AI Providers"]
        Gemini["Google Gemini"]
        Databricks["Databricks AI"]
    end

    subgraph Database["🗄️ Database"]
        MySQL["MySQL / PostgreSQL"]
    end

    subgraph Tools["🛠️ Security Tools - Docker Container"]
        Passive["Passive Recon\n(Whois, Subfinder, Amass)"]
        Active["Active Recon\n(Nmap, WhatWeb, SSLScan)"]
        Discovery["Asset Discovery\n(DNS Resolver, HTTPx)"]
        Enum["Enumeration\n(FFUF, Nmap NSE)"]
        Vuln["Vulnerability\n(SQLMap, Nuclei, Dalfox)"]
    end

    subgraph External["🌐 External Services"]
        HIBP["HaveIBeenPwned API"]
        MSAuth["Microsoft Entra ID"]
    end

    Browser --> UI
    UI --> API
    MSAL --> MSAuth
    SSE <--> EventMgr

    API --> Auth
    API --> ScanMgr
    API --> WebIntel
    Auth --> MySQL
    Auth <--> MSAuth
    ScanMgr --> MySQL
    ScanMgr --> EventMgr
    ScanMgr --> Tools
    ScanMgr --> AI
    WebIntel --> HIBP

    Gemini -.->|Primary| ScanMgr
    Databricks -.->|Fallback| ScanMgr

    Passive --> ScanMgr
    Active --> ScanMgr
    Discovery --> ScanMgr
    Enum --> ScanMgr
    Vuln --> ScanMgr
```

---

## 🚀 Features

### 🛡️ Core Security Capabilities

- **Multi-Phase Scanning:** Automated workflow covering Passive Recon, Asset Discovery, Active Recon, Enumeration, and Vulnerability Analysis.
- **Granular Tool Execution:** Individual tools are orchestrated directly (no monolithic scripts), providing real-time per-tool feedback, better error handling, and fine-grained status updates.
- **Tool Integration:** Orchestrates 15+ industry-standard tools including:
  - **Passive Recon:** Whois, NSLookup, Subfinder (Passive), Amass Passive, Assetfinder, WebScraperRecon.
  - **Active Recon:** Nmap Top 1000, WhatWeb, WafW00f, SSLScan.
  - **Asset Discovery:** Subfinder (Full), DNS Resolver, Alive Web Hosts.
  - **Enumeration:** FFUF, Nmap Vulnerability Scan.
  - **Vulnerability Analysis:** SQLMap, Dalfox, Nuclei.
- **Advanced Pipeline Features:**
  - **Retry Logic:** Tools automatically retry up to 3 times on failure.
  - **Configurable Timeouts:** Commands are terminated if they exceed a specified duration.
  - **File Piping:** Support for passing output files between tools (e.g., `subs.txt` → `dnsx`).

### 🌐 Web Intelligence

- **Domain Intelligence Module:** Comprehensive domain analysis without running a full scan:
  - **DNS Records:** A, AAAA, MX, NS, TXT, CNAME, SOA.
  - **DNSSEC Status:** Validates domain security extensions.
  - **Email Security:** SPF, DMARC, DKIM analysis.
  - **WHOIS Information:** Domain registration and ownership data.
  - **IP Geolocation & Traceroute:** Network path analysis.
  - **IP Blacklist Check:** Spam and reputation checks.
  - **OSINT Data Collection:** Emails, phones, social links (in full mode).
  - **TLS/SSL Analysis:** Certificate validation and security headers.
- **Scan History:** Persistent search history with easy re-analysis.

### 🔒 Email Breach Checker

- **HaveIBeenPwned Integration:** Check if email addresses have been compromised in known data breaches.
- **Detailed Breach Information:** View breach names, dates, and exposed data types.

### 🧠 AI-Powered Analysis

- **Dual AI Provider Support:**
  - **Google Gemini** (Primary)
  - **Databricks AI** (Secondary/Fallback)
- **Smart Summaries:** Converts complex terminal logs into human-readable executive summaries.
- **Remediation Advice:** Provides AI-generated mitigation strategies for identified vulnerabilities.
- **Severity Classification:** Automatic categorization of findings (Critical, High, Medium, Low, Info).

### 💻 Modern User Interface

- **Real-Time Updates (SSE):** Built with **Server-Sent Events** for app-wide real-time updates.
  - **Dashboard:** Live counter for running scans with vulnerability statistics.
  - **History:** Auto-refreshing list of scans with search and filtering.
  - **Scan Details:** Live logs, progress bars, and phase grouping.
- **Theme Support:** Full **Light & Dark Mode** support across all pages.
- **Interactive Reports:** Filter findings by severity, view raw logs and exact commands executed.
- **PDF Reporting:** Generate professional security reports with a single click.
- **Responsive Design:** Works seamlessly on desktop and tablet devices.

### 👥 User Management & Authentication

- **Microsoft SSO Integration:** Single Sign-On with Microsoft Azure AD/Entra ID.
- **Local Authentication:** Traditional email/password registration and login.
- **Password Strength Validation:** Enforces secure password policies.
- **Admin Dashboard:**
  - View and manage all users.
  - Activate/deactivate user accounts.
  - Grant or revoke admin privileges.
- **User Profiles:** Personal profile management with organization details.

---

## 🛠️ Technology Stack

### Frontend

| Technology                                                                     | Purpose          |
| ------------------------------------------------------------------------------ | ---------------- |
| [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | UI Framework     |
| [Vite](https://vitejs.dev/)                                                    | Build Tool       |
| [Tailwind CSS](https://tailwindcss.com/)                                       | Styling          |
| [MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js)  | Microsoft SSO    |
| [Framer Motion](https://www.framer.com/motion/)                                | Animations       |
| [Lucide React](https://lucide.dev/)                                            | Icons            |
| Context API                                                                    | State Management |

### Backend

| Technology                                        | Purpose                   |
| ------------------------------------------------- | ------------------------- |
| [FastAPI](https://fastapi.tiangolo.com/) (Python) | API Framework             |
| [Prisma](https://www.prisma.io/)                  | ORM                       |
| MySQL / PostgreSQL                                | Database                  |
| `asyncio` + `asyncssh`                            | Concurrent Task Execution |
| Google Generative AI (Gemini)                     | Primary AI Engine         |
| Databricks AI                                     | Secondary AI Engine       |
| PyJWT                                             | Authentication            |
| Passlib                                           | Password Hashing          |

### Infrastructure

| Technology                     | Purpose                |
| ------------------------------ | ---------------------- |
| Docker                         | Containerization       |
| Azure Container Apps (ACA)     | Cloud Deployment       |
| Azure Container Registry (ACR) | Image Registry         |
| Azure Files                    | Persistent Storage     |
| GitHub Actions                 | CI/CD Pipeline         |
| Nginx                          | Frontend Reverse Proxy |

---

## 📦 Deployment

Scout is fully containerized and supports multiple deployment options:

### 🐳 Docker Compose (Local Development)

```bash
# Clone the repository
git clone https://github.com/your-org/scout.git
cd scout

# Start all services
docker-compose up -d
```

### ☁️ Azure Container Apps (Production)

The project includes a complete CI/CD pipeline via **GitHub Actions** that:

1. Builds Docker images for frontend and backend.
2. Pushes images to Azure Container Registry.
3. Deploys to Azure Container Apps with environment configuration.
4. Manages secrets (JWT, API keys, database URL).

👉 **[Read the Full Deployment Guide](DOCKER.md)**

---

## 📂 Project Structure

```
Scout/
├── backend/                 # FastAPI backend application
│   ├── app/
│   │   ├── api/            # API routers (auth, scans, webintel, admin)
│   │   ├── core/           # Configuration, security, tool definitions
│   │   ├── models/         # Pydantic models
│   │   └── services/       # Business logic (scan_manager, AI, etc.)
│   └── prisma/             # Database schema and migrations
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React contexts (SSE, Theme, Auth)
│   │   ├── pages/          # Page components
│   │   └── config/         # MSAL and app configuration
│   └── public/             # Static assets
├── .github/workflows/      # GitHub Actions CI/CD
├── Dockerfile.backend      # Backend container definition
├── Dockerfile.frontend     # Frontend container definition
└── docker-compose.yml      # Local development setup
```

### Key Files

| File                                   | Description                                              |
| -------------------------------------- | -------------------------------------------------------- |
| `backend/app/core/tool_config.py`      | Defines all security tools, commands, and pipeline logic |
| `backend/app/services/scan_manager.py` | Core scanning engine with orchestration logic            |
| `backend/app/api/webintel.py`          | Web Intelligence API endpoints                           |
| `frontend/src/context/SSEContext.tsx`  | Real-time event stream management                        |
| `frontend/src/pages/ScanDetails.tsx`   | Detailed scan results with phase grouping                |

---

## ⚙️ Configuration

### Environment Variables

**Backend:**

```env
DATABASE_URL=mysql://user:password@host:3306/scout
JWT_SECRET=your-secret-key
GEMINI_API_KEY=your-gemini-api-key
DATABRICKS_API_KEY=your-databricks-key
DATABRICKS_API_BASE=https://your-instance.databricks.com
DATABRICKS_MODEL=your-model-name
ENABLE_MICROSOFT_SSO=true
MICROSOFT_CLIENT_ID=your-azure-client-id
EXECUTION_MODE=local
```

**Frontend (Build-time):**

```env
VITE_MICROSOFT_CLIENT_ID=your-azure-client-id
VITE_MICROSOFT_AUTHORITY=https://login.microsoftonline.com/common
```

---

## 🔒 Security Note

> [!CAUTION]
> This tool is intended for **authorized security testing and educational purposes only**. Always obtain explicit permission before scanning any target. The developers are not responsible for misuse or illegal activities.

---

## 📄 License

This project is proprietary software owned by Sarral.io.

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request.
