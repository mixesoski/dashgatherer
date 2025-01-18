# Garmin TRIMP Data Fetcher

Simple Python script to fetch Training Impulse (TRIMP) values from Garmin Connect activities for the last 9 days.

## Setup

1. Create a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install requirements:
```bash
pip install -r requirements.txt
```

3. Create `.env` file with your Garmin credentials:
```
GARMIN_EMAIL=your.email@example.com
GARMIN_PASSWORD=your_password
```

## Usage

Run the script:
```bash
python garmin_trimp.py
```

The script will:
- Connect to Garmin Connect using your credentials
- Fetch activities from the last 9 days
- Extract TRIMP values from each activity
- Display activity details including:
  - Activity name
  - Date and time
  - Activity type
  - TRIMP value
- Double TRIMP values for strength training activities

## Notes

- Requires Garmin Connect account with TRIMP data available
- TRIMP values are typically available for activities recorded with compatible Garmin devices
- Uses garminconnect library to access Garmin Connect API
