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

## CodeRabbit Dev Coach

CodeRabbit is configured as the LifeMosaic Dev Coach in [.coderabbit.yaml](file:///Users/ak/Library/CloudStorage/OneDrive-Agenvise/Desktop/healthify/.coderabbit.yaml). Each PR gets a standard review plus a playful, non-blocking “Dev Habit Summary” with LifeMosaic metaphors:

- Wellness: readability and clarity wins
- Savings: refactors and deletions
- Sustainability: reuse over duplication
- Swap opportunities: healthier/cheaper/eco alternatives for bad habits

The fun section is included in the walkthrough summary once per PR, and normal correctness/security checks remain unchanged.

## Weekly Dev Wellness Summary

A scheduled GitHub Action posts or updates a weekly issue with a LifeMosaic-themed summary and metrics. Workflow:

- [.github/workflows/weekly-dev-wellness.yml](file:///Users/ak/Library/CloudStorage/OneDrive-Agenvise/Desktop/healthify/.github/workflows/weekly-dev-wellness.yml)

## Demo Outputs

Use these examples as the judging artifacts.

### Example PR Comment

---
Dev Habit Summary
- Habit score: 8/10
- Wellness: clearer naming and smaller functions
- Savings: 120 LOC removed via refactor
- Sustainability: reused shared components in 2 places
Swap opportunities:
- [ ] Replace nested conditionals with guard clauses (Healthier)
- [ ] Extract duplicated logic into a shared hook (Eco)
---

### Example Weekly Summary Issue

Dev Wellness for this week

- Refactor savings: 420 LOC (removed 640, added 220)
- Quality wellness: 12 test lines added
- Tech-debt progress: 6 TODO lines touched

Narrative: You saved 420 LOC and added 12 test lines — codebase wellness is trending up 📈.

Swap opportunities to watch for next week:
- [ ] Reduce duplication in hot paths (Eco)
- [ ] Replace deep nesting with guard clauses (Healthier)
- [ ] Optimize repeated heavy loops (Cheaper)
