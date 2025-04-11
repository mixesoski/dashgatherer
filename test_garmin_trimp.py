#!/usr/bin/env python3
"""
Test script for Garmin Connect authentication and TRIMP data retrieval.
This helps diagnose issues with Garmin Connect API access.
"""

import os
import sys
import traceback
from datetime import datetime, timedelta
import json
from garminconnect import Garmin
import requests
import urllib.parse

def test_login_with_cookies(email, password):
    """Attempt to login using direct cookie-based approach"""
    print(f"\n===== Testing cookie-based login for {email} =====")

    safe_password = password
    if any(c in password for c in ['@', '!', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '?', '/']):
        print("Password contains special characters - applying URL encoding")
        safe_password = urllib.parse.quote_plus(password)
    
    try:
        session = requests.Session()
        
        # Setup session with proper headers
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'origin': 'https://sso.garmin.com',
            'nk': 'NT'
        })
        
        # First get the SSO page to collect initial cookies
        sso_url = "https://sso.garmin.com/sso/signin"
        print(f"Fetching initial SSO page: {sso_url}")
        
        params = {
            'service': 'https://connect.garmin.com/modern',
            'webhost': 'https://connect.garmin.com/modern',
            'source': 'https://connect.garmin.com/signin',
            'redirectAfterAccountLoginUrl': 'https://connect.garmin.com/modern',
            'redirectAfterAccountCreationUrl': 'https://connect.garmin.com/modern',
            'gauthHost': 'https://sso.garmin.com/sso',
            'locale': 'en_US',
            'id': 'gauth-widget',
            'cssUrl': 'https://connect.garmin.com/gauth-custom-v1.2-min.css',
            'clientId': 'GarminConnect',
            'rememberMeShown': 'true',
            'rememberMeChecked': 'false',
            'createAccountShown': 'true',
            'openCreateAccount': 'false',
            'displayNameShown': 'false',
            'consumeServiceTicket': 'false',
            'initialFocus': 'true',
            'embedWidget': 'false',
            'generateExtraServiceTicket': 'true',
            'generateTwoExtraServiceTickets': 'false',
            'generateNoServiceTicket': 'false',
            'globalOptInShown': 'true',
            'globalOptInChecked': 'false',
            'mobile': 'false',
            'connectLegalTerms': 'true',
            'locationPromptShown': 'true',
            'showPassword': 'true'
        }
        
        print("Sending initial request...")
        response = session.get(sso_url, params=params)
        print(f"Initial response status: {response.status_code}")
        
        if response.status_code != 200:
            print("Initial SSO page request failed")
            print(f"Error body: {response.text[:200]}...")
            raise Exception("Failed to load Garmin login page")
        
        # Now attempt the actual login
        print("Preparing login request...")
        payload = {
            'username': email,
            'password': safe_password,
            'embed': 'false',
            'rememberme': 'on'  # Keep the session alive longer
        }
        
        login_url = "https://sso.garmin.com/sso/signin"
        print(f"Sending login request to: {login_url}")
        
        login_response = session.post(login_url, params=params, data=payload)
        print(f"Login response status: {login_response.status_code}")
        
        if login_response.status_code != 200:
            print("Login request failed")
            print(f"Error body: {login_response.text[:200]}...")
            raise Exception("Failed to login to Garmin Connect")
        
        # Check if login was successful by looking for ticket in response
        if "ticket" not in login_response.text:
            print("No ticket found in response, login likely failed")
            print(f"Response excerpt: {login_response.text[:200]}...")
            raise Exception("Login authentication failed - no ticket found")
        
        print("Login appears successful, found ticket in response")
        
        # Use the existing client but with our authenticated session
        garmin_client = Garmin(email, password, session=session)
        print("Created Garmin client with authenticated session")
        
        # Test that we're properly authenticated
        print("Testing connection with user profile request...")
        try:
            profile = garmin_client.get_full_name()
            print(f"Successfully authenticated! User profile: {profile}")
            return garmin_client
        except Exception as e:
            print(f"Profile request failed: {str(e)}")
            print(f"Full error: {traceback.format_exc()}")
            raise Exception("Authentication appeared successful but API requests failed")
        
    except Exception as e:
        print(f"Cookie-based login failed with error: {str(e)}")
        print(f"Error type: {type(e)}")
        print(f"Full traceback: {traceback.format_exc()}")
        return None

def test_activities_and_trimp(client):
    """Test retrieving activities and TRIMP data"""
    print("\n===== Testing activities and TRIMP data retrieval =====")
    
    try:
        # Get today's date and 30 days back
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        
        print(f"Getting activities from {start_str} to {end_str}")
        
        activities = client.get_activities_by_date(start_str, end_str)
        print(f"Found {len(activities)} activities")
        
        if len(activities) == 0:
            print("No activities found in the date range")
            return
        
        # Look at most recent activity for TRIMP data
        recent_activity = activities[0]
        activity_id = recent_activity['activityId']
        activity_name = recent_activity.get('activityName', 'Unknown')
        activity_date = recent_activity.get('startTimeLocal', 'Unknown date')
        
        print(f"\nExamining activity: {activity_name} from {activity_date}")
        print(f"Activity ID: {activity_id}")
        
        print("Getting detailed activity data...")
        activity_details = client.get_activity(activity_id)
        
        # Look for TRIMP data in connectIQMeasurements
        trimp_found = False
        if 'connectIQMeasurements' in activity_details:
            print("\nFound connectIQMeasurements in activity data")
            print(f"Number of Connect IQ measurements: {len(activity_details['connectIQMeasurements'])}")
            
            for item in activity_details['connectIQMeasurements']:
                print(f"Measurement: developerFieldNumber={item.get('developerFieldNumber')}, value={item.get('value')}")
                if item.get('developerFieldNumber') == 4:
                    trimp_value = round(float(item.get('value', 0)), 1)
                    print(f"\n✓ FOUND TRIMP VALUE: {trimp_value}")
                    trimp_found = True
        else:
            print("No connectIQMeasurements found in activity data")
        
        if not trimp_found:
            print("\n⚠ NO TRIMP DATA FOUND FOR THIS ACTIVITY")
            print("Check that your device is recording TRIMP data through Connect IQ")
        
    except Exception as e:
        print(f"Error testing activities and TRIMP: {str(e)}")
        print(f"Full error: {traceback.format_exc()}")

def main():
    """Main test function"""
    print("==================================================")
    print("GARMIN CONNECT AUTHENTICATION AND TRIMP DATA TEST")
    print("==================================================")
    
    if len(sys.argv) != 3:
        print("Usage: python test_garmin_trimp.py <email> <password>")
        print("Example: python test_garmin_trimp.py user@example.com mypassword")
        return
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    print(f"Testing with email: {email}")
    print(f"Password length: {len(password)} characters")
    
    # Try cookie-based login
    client = test_login_with_cookies(email, password)
    
    if client:
        print("\n✓ LOGIN SUCCESSFUL!")
        # Test activities and TRIMP data
        test_activities_and_trimp(client)
    else:
        print("\n❌ ALL LOGIN METHODS FAILED")
        print("Recommendations:")
        print("1. Verify your email and password are correct")
        print("2. Try logging into Garmin Connect web interface manually")
        print("3. Check if your account has two-factor authentication enabled")
        print("4. If using special characters in password, try a simpler password temporarily")
        print("5. Ensure your IP address is not blocked by Garmin")

if __name__ == "__main__":
    main() 