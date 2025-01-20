import os
from dotenv import load_dotenv, find_dotenv
from supabase import create_client

# Load environment variables
load_dotenv(find_dotenv())

# Get environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Initialize Supabase client
if not SUPABASE_URL or not SUPABASE_URL.startswith('https://'):
    raise Exception("Invalid SUPABASE_URL. Must start with https://")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_garmin_credentials(user_id):
    """Get Garmin credentials from Supabase for given user_id."""
    response = supabase.table('garmin_credentials').select('*').eq('user_id', user_id).execute()
    if not response.data:
        raise Exception(f"No credentials found for user_id: {user_id}")
    
    credentials = response.data[0]
    return credentials['email'], credentials['password'] 