import requests
from bs4 import BeautifulSoup
import json

def fetch_leaderboard_data():
    try:
        url = 'https://rmi-gideon.gtarena.ph/leaderboard'
        response = requests.get(url)

        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')

            # Find the div with id="app" and extract data-page attribute
            app_div = soup.find('div', {'id': 'app'})
            if app_div and 'data-page' in app_div.attrs:
                data_page = app_div['data-page']
                page_data = json.loads(data_page)

                # Extract draws data
                draws = page_data['props']['draws']

                print(f"Found {len(draws)} recent draws")
                print(f"Latest draw result: {draws[0]['result1'] if draws[0]['result1'] else 'Pending'}")

                return draws
            else:
                print("Could not find data-page attribute")
                return None
        else:
            print(f"Failed to fetch data. Status code: {response.status_code}")
            return None

    except Exception as e:
        print(f"Error fetching leaderboard data: {e}")
        return None

# Usage example
if __name__ == "__main__":
    draws = fetch_leaderboard_data()
    if draws:
        for draw in draws[:5]:  # Show first 5 draws
            result = draw['result1'] or 'Pending'
            print(f"Draw {draw['id']}: {result} - Total Bets: {draw['totalBets']} - Total Amount: {draw['totalBetAmount']}")