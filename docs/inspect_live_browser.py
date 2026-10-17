import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

os.makedirs('docs/screenshots', exist_ok=True)

opts = Options()
opts.add_argument('--headless=new')
opts.add_argument('--disable-gpu')
opts.add_argument('--no-sandbox')
opts.add_argument('--window-size=1440,1200')
opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(options=opts)
try:
    print('1. Navigating to https://mumbai-air-atlas.vercel.app ...')
    driver.get('https://mumbai-air-atlas.vercel.app')
    
    # Check splash screen at t=0.3s
    time.sleep(0.3)
    splash_h1 = driver.find_elements(By.TAG_NAME, 'h1')
    splash_text = [h.text for h in splash_h1 if 'AIR ATLAS' in h.text]
    print(f'Splash screen active at 0.3s: {len(splash_text) > 0}')
    driver.save_screenshot('docs/screenshots/live_step1_splash.png')
    
    # Wait for splash screen to complete its animation + fadeout and data to resolve
    print('Waiting for splash screen exit and API telemetry to settle...')
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    # Wait up to 10s for station telemetry to load into DOM
    try:
        WebDriverWait(driver, 10).until(lambda d: 'Bandra Kurla Complex' in d.page_source)
        print('Live station telemetry loaded into DOM successfully.')
    except Exception as e:
        print('Wait timed out:', e)
    
    time.sleep(1.0)
    
    # Check if splash screen has unmounted
    splash_remains = [h.text for h in driver.find_elements(By.TAG_NAME, 'h1') if 'AIR ATLAS' in h.text]
    print(f'Splash screen remains in DOM: {len(splash_remains) > 0}')
    
    # Check console logs for errors
    logs = driver.get_log('browser')
    print(f'\n2. Browser console logs ({len(logs)} entries):')
    severe_errors = []
    for log in logs:
        if log['level'] in ['SEVERE', 'WARNING']:
            print(f"  [{log['level']}] {log['message']}")
            if log['level'] == 'SEVERE':
                severe_errors.append(log['message'])
    if not severe_errors:
        print('  Zero SEVERE console errors detected.')
        
    # Check key page elements visibility
    body = driver.find_element(By.TAG_NAME, 'body')
    body_text = body.text
    print('\n3. DOM elements verification:')
    keywords = [
        'Bandra Kurla Complex',
        '105',
        'Moderate',
        'SURFACE METEOROLOGY',
        'AIR TEMPERATURE',
        'RELATIVE HUMIDITY',
        'km/h',
        'NNE',
        'CPCB AQI SPECTRUM TRACK',
        'Forecast Horizon',
        'Hourly Particulate Matrix',
        'POOLED FORWARD CHAINING',
    ]
    for keyword in keywords:
        found = keyword in body_text
        print(f'  - "{keyword}": {"FOUND" if found else "NOT FOUND"}')
        
    # Check viewport scroll height and visible cards
    scroll_height = driver.execute_script("return document.body.scrollHeight;")
    print(f'\n4. Document scroll height: {scroll_height}px')
    
    # Capture full page view screenshot
    driver.save_screenshot('docs/screenshots/live_step2_dashboard.png')
    print('Captured docs/screenshots/live_step2_dashboard.png')

    # Test toggling to Day Edition
    toggle_btn = driver.find_element(By.CSS_SELECTOR, "button[aria-label='Toggle Day / Night edition']")
    toggle_btn.click()
    time.sleep(1)
    driver.save_screenshot('docs/screenshots/live_step3_day_theme.png')
    print('Captured docs/screenshots/live_step3_day_theme.png (Day Edition)')

    # 5. Mobile viewport verification (390 x 844 iPhone 14 dimensions)
    print('\n5. Testing mobile screen rendering (390x844)...')
    driver.set_window_size(390, 844)
    time.sleep(0.5)
    driver.save_screenshot('docs/screenshots/live_mobile_hero_verified.png')
    print('Captured docs/screenshots/live_mobile_hero_verified.png')

finally:
    driver.quit()
