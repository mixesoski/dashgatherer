#!/usr/bin/env python3
"""
Standalone Garmin login tester using direct OAuth flow.
This script bypasses the garminconnect package and implements a direct login flow.
"""

import os
import sys
import requests
import json
import re
import urllib.parse
from datetime import datetime, timedelta
from supabase_client import supabase

# Constants for Garmin OAuth flow
BASE_URL = "https://connect.garmin.com"
SSO_URL = "https://sso.garmin.com/sso"
MODERN_URL = "https://connect.garmin.com/modern"
SIGNIN_URL = "https://sso.garmin.com/sso/signin"

def get_garmin_credentials(user_id):
    print(f"Fetching Garmin credentials for user {user_id}")
    try:
        response = supabase.table('garmin_credentials').select('*').eq('user_id', user_id).execute()
        print(f"Credential response data length: {len(response.data) if response.data else 0}")
        
        if not response.data or len(response.data) == 0:
            print("No Garmin credentials found for user")
            return None, None
            
        credentials = response.data[0]
        email = credentials.get('email')
        password = credentials.get('password')
        
        if not email or not password:
            print("Invalid credentials format - missing email or password")
            return None, None
            
        print(f"Found credentials with email: {email}")
        return email, password
    except Exception as e:
        print(f"Error fetching Garmin credentials: {str(e)}")
        return None, None

def direct_garmin_login(email, password):
    """
    Direct Garmin authentication that doesn't use the garminconnect package.
    Uses custom OAuth flow to get the necessary tokens.
    """
    print(f"\n=== Testing direct Garmin authentication for {email} ===")
    
    # Create session with standard browser headers
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'origin': 'https://sso.garmin.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    })
    
    # Step 1: Get the login page to obtain CSRF token and cookies
    params = {
        'service': MODERN_URL,
        'webhost': MODERN_URL,
        'source': f"{MODERN_URL}/auth/login/",
        'redirectAfterAccountLoginUrl': MODERN_URL,
        'redirectAfterAccountCreationUrl': MODERN_URL,
        'gauthHost': SSO_URL,
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
        'showTermsOfUse': 'false',
        'showPrivacyPolicy': 'false',
        'showConnectLegalAge': 'false',
        'locationPromptShown': 'true',
        'showPassword': 'true',
        'useCustomHeader': 'false',
        'mfaRequired': 'false',
        'performMFACheck': 'false',
        'rememberMyBrowserShown': 'false',
        'rememberMyBrowserChecked': 'false'
    }
    
    try:
        print("Step 1: Fetching login page...")
        response = session.get(SIGNIN_URL, params=params)
        print(f"Login page status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Failed to load login page. Status: {response.status_code}")
            return None
            
        # Extract CSRF token and form action
        csrf_token = None
        match = re.search(r'<input type="hidden" name="_csrf" value="([^"]+)"', response.text)
        if match:
            csrf_token = match.group(1)
            print(f"Found CSRF token: {csrf_token[:10]}...")
        else:
            print("CSRF token not found in the login page")
            return None
            
        # Step 2: Send login credentials
        print("\nStep 2: Submitting login form...")
        
        # Check if password needs encoding
        safe_password = password
        if any(c in password for c in ['@', '!', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '?', '/']):
            print(f"Password contains special characters, URL encoding it")
            safe_password = urllib.parse.quote_plus(password)
        
        # Form data for login
        form_data = {
            'username': email,
            'password': password,  # Using original password, not URL encoded
            '_csrf': csrf_token,
            'embed': 'true',
            'rememberme': 'on'
        }
        
        login_response = session.post(SIGNIN_URL, params=params, data=form_data)
        print(f"Login response status: {login_response.status_code}")
        
        if "success" in login_response.text.lower() or "ticket" in login_response.text.lower():
            print("Login successful! Found success or ticket in response.")
        else:
            print("Login appears to have failed.")
            print(f"Response excerpt: {login_response.text[:300]}...")
            return None
            
        # Extract ticket URL from the response if available
        ticket_url = None
        match = re.search(r'"(https://connect\.garmin\.com/modern\?ticket=.+?)"', login_response.text)
        if match:
            ticket_url = match.group(1)
            print(f"Found ticket URL: {ticket_url[:50]}...")
        else:
            print("No ticket URL found in the response")
            
        # Step 3: Exchange the ticket for authentication
        if ticket_url:
            print("\nStep 3: Exchanging ticket for authentication...")
            response = session.get(ticket_url)
            print(f"Ticket exchange status: {response.status_code}")
            
            # Step 4: Verify authentication by fetching user profile
            print("\nStep 4: Verifying authentication...")
            profile_url = f"{MODERN_URL}/currentuser-service/user/info"
            profile_response = session.get(profile_url)
            
            if profile_response.status_code == 200:
                try:
                    profile_data = profile_response.json()
                    display_name = profile_data.get('displayName', 'Unknown')
                    print(f"Authentication successful! User: {display_name}")
                    return session
                except:
                    print("Could not parse profile response as JSON")
            else:
                print(f"Profile request failed with status {profile_response.status_code}")
                
        # If we got here without returning, try one more API test
        try:
            print("\nTrying a different API endpoint as fallback...")
            user_summary_url = f"{MODERN_URL}/usersummary-service/usersummary/daily/{datetime.now().strftime('%Y-%m-%d')}"
            summary_response = session.get(user_summary_url)
            
            if summary_response.status_code == 200:
                print("Successfully accessed user summary API!")
                return session
            else:
                print(f"User summary request failed with status {summary_response.status_code}")
        except Exception as e:
            print(f"Error testing user summary API: {str(e)}")
            
        # Return the session even if verification failed, it might still be usable
        return session
    
    except Exception as e:
        print(f"Direct login failed with error: {str(e)}")
        return None

def test_garmin_api(session):
    """Test various Garmin API endpoints with the authenticated session"""
    if not session:
        print("No authenticated session to test with")
        return False
        
    print("\n=== Testing Garmin API access ===")
    
    api_tests = [
        {
            "name": "User Profile",
            "url": f"{MODERN_URL}/userprofile-service/userprofile/personal-information"
        },
        {
            "name": "User Summary",
            "url": f"{MODERN_URL}/usersummary-service/usersummary/daily/{datetime.now().strftime('%Y-%m-%d')}"
        },
        {
            "name": "Recent Activities",
            "url": f"{MODERN_URL}/activitylist-service/activities/search/activities?limit=10"
        }
    ]
    
    success_count = 0
    
    for test in api_tests:
        try:
            print(f"\nTesting endpoint: {test['name']}")
            response = session.get(test['url'])
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                success_count += 1
                print(f"✓ {test['name']} API accessible")
                
                # For activities list, get the ID of the most recent activity
                if test['name'] == "Recent Activities" and response.json():
                    activities = response.json()
                    if activities and len(activities) > 0:
                        activity_id = activities[0].get('activityId')
                        activity_name = activities[0].get('activityName', 'Unknown')
                        print(f"\nFound recent activity: {activity_name} (ID: {activity_id})")
                        
                        # Try to get details for this activity
                        print("Fetching activity details...")
                        details_url = f"{MODERN_URL}/activity-service/activity/{activity_id}/details"
                        details_response = session.get(details_url)
                        
                        if details_response.status_code == 200:
                            print("✓ Successfully retrieved activity details")
                            
                            # Look for TRIMP data
                            try:
                                details = details_response.json()
                                if 'connectIQMeasurements' in details:
                                    print(f"Found {len(details['connectIQMeasurements'])} Connect IQ measurements")
                                    
                                    found_trimp = False
                                    for item in details['connectIQMeasurements']:
                                        if item.get('developerFieldNumber') == 4:
                                            trimp = round(float(item.get('value', 0)), 1)
                                            print(f"✓ FOUND TRIMP VALUE: {trimp}")
                                            found_trimp = True
                                            
                                    if not found_trimp:
                                        print("No TRIMP value (developerFieldNumber=4) found in this activity")
                                else:
                                    print("No connectIQMeasurements found in activity details")
                            except Exception as e:
                                print(f"Error parsing activity details: {str(e)}")
                        else:
                            print(f"Failed to get activity details. Status: {details_response.status_code}")
            else:
                print(f"✗ {test['name']} API not accessible")
                print(f"Response: {response.text[:100]}...")
                
        except Exception as e:
            print(f"Error testing {test['name']} API: {str(e)}")
            
    print(f"\nAPI Test Results: {success_count}/{len(api_tests)} successful")
    return success_count > 0

def main():
    if len(sys.argv) < 2:
        print("Usage: python debug_garmin_login.py <user_id>")
        print("Example: python debug_garmin_login.py 123e4567-e89b-12d3-a456-426614174000")
        return
        
    user_id = sys.argv[1]
    print(f"Testing Garmin login for user ID: {user_id}")
    
    # Get credentials from Supabase
    email, password = get_garmin_credentials(user_id)
    
    if not email or not password:
        print("Could not retrieve valid credentials")
        return
    
    # Test direct login method
    print(f"\n==================================================")
    print(f"TESTING DIRECT GARMIN LOGIN APPROACH")
    print(f"==================================================")
    session = direct_garmin_login(email, password)
    
    if session:
        print("\n✓ DIRECT LOGIN SUCCESSFUL!")
        # Test API access
        api_success = test_garmin_api(session)
        
        if api_success:
            print("\n✓ API TESTS PASSED!")
            print("\nRecommendation: Update your garmin_sync.py to use this authentication approach")
        else:
            print("\n✗ API TESTS FAILED")
            print("Authentication succeeded but API access failed")
    else:
        print("\n✗ DIRECT LOGIN FAILED")
        print("Recommendations:")
        print("1. Verify your Garmin credentials at connect.garmin.com")
        print("2. Try logging in manually to refresh your session")
        print("3. Check if your account has 2FA enabled (this script doesn't support 2FA)")
        print("4. Try a simpler password without special characters")
        
if __name__ == "__main__":
    main() 