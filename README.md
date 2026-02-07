# LifeMosaic (Healthify)

LifeMosaic is a full-stack wellness platform that helps users log daily habits, analyze health and spending, and get AI-assisted recommendations.

## Apps

- **Frontend**: Next.js app in `frontend/`
- **Backend**: FastAPI app in `backend/`

## Quick Start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Environment

Create `.env.local` in `frontend/` and set required keys such as `OPENAI_API_KEY`.
