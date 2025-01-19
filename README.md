# Garmin TRIMP Data Fetcher

Web application for fetching and analyzing Training Impulse (TRIMP) values from Garmin Connect activities.

## Features

- User authentication with Supabase
- Secure storage of Garmin credentials
- Fetch last 9 days of activities
- Calculate and display TRIMP values
- Generate TRIMP trend charts
- Double TRIMP values for strength training activities

## Tech Stack

- Frontend:
  - React with TypeScript
  - Vite
  - shadcn/ui components
  - TanStack Query
  - Supabase Client

- Backend:
  - Python Flask API
  - garminconnect library
  - pandas for data processing
  - matplotlib for charts
  - Supabase Python Client

## Setup

1. Install frontend dependencies:
```bash
npm install
```

2. Create Python virtual environment and install backend dependencies:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

3. Create `.env` file with your credentials:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## Running the Application

1. Start the Flask API server:
```bash
python api.py
```

2. Start the frontend development server:
```bash
npm run dev
```

3. Open http://localhost:5173 in your browser

## Development

- Frontend runs on port 5173
- Flask API runs on port 5001
- API endpoints:
  - POST /api/sync-garmin - Sync Garmin data for a user

## Notes

- Requires Garmin Connect account with TRIMP data available
- TRIMP values are typically available for activities recorded with compatible Garmin devices
- Rate limiting is handled with exponential backoff
