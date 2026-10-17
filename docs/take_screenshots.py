import time
import os
from PIL import Image
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

os.makedirs('docs/screenshots', exist_ok=True)

def take_shots():
    opts = Options()
    opts.add_argument('--headless=new')
    opts.add_argument('--disable-gpu')
    opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-dev-shm-usage')
    opts.add_argument('--force-device-scale-factor=2')
    opts.add_argument('--window-size=1440,1200')

    driver = webdriver.Chrome(options=opts)
    
    target_url = os.environ.get('TARGET_URL')
    if not target_url:
        import urllib.request
        try:
            urllib.request.urlopen('http://127.0.0.1:5173', timeout=1)
            target_url = 'http://127.0.0.1:5173'
        except Exception:
            target_url = 'https://mumbai-air-atlas.vercel.app'
    print(f"Capturing screenshots from: {target_url}")

    try:
        # 1. Desktop Day Edition
        driver.get(target_url)
        time.sleep(1)
        driver.execute_script("localStorage.setItem('mumbai-air-theme', 'light');")
        driver.refresh()
        time.sleep(0.5)  # Capture splash screen during its active sequence
        driver.save_screenshot('docs/screenshots/splash_screen.png')
        print('Captured docs/screenshots/splash_screen.png')
        WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CLASS_NAME, 'data-num')))
        time.sleep(2.5)  # Allow splash fadeout, count-up and blur text animations to settle
        
        # Save hero day
        driver.save_screenshot('docs/screenshots/hero_day.png')
        print('Captured docs/screenshots/hero_day.png')

        # 2. Desktop Night Edition
        toggle_btn = driver.find_element(By.CSS_SELECTOR, "button[aria-label='Toggle Day / Night edition']")
        toggle_btn.click()
        time.sleep(2.5)
        driver.save_screenshot('docs/screenshots/hero_night.png')
        print('Captured docs/screenshots/hero_night.png')

        # 3. Component screenshots (Night theme)
        # Make header static so it stays at page top and never overlaps scrolled sections
        driver.execute_script("""
            const header = document.querySelector('header');
            if (header) {
                header.style.position = 'static';
            }
        """)
        time.sleep(1)

        sections = driver.find_elements(By.TAG_NAME, 'section')
        print(f'Found {len(sections)} sections on page.')

        # Section 0: Hero AQI
        # Section 1: Monitoring Topography (Map & Directory)
        if len(sections) > 1:
            driver.execute_script("arguments[0].scrollIntoView();", sections[1])
            time.sleep(1.5)
            sections[1].screenshot('docs/screenshots/map.png')
            print('Captured docs/screenshots/map.png')

        # Section 2: 48-Hour Forecast Horizon
        if len(sections) > 2:
            driver.execute_script("arguments[0].scrollIntoView();", sections[2])
            time.sleep(1.5)
            sections[2].screenshot('docs/screenshots/forecast_chart.png')
            print('Captured docs/screenshots/forecast_chart.png')

        # Section 3: 60-Day Calendar Heatmap
        if len(sections) > 3:
            driver.execute_script("arguments[0].scrollIntoView();", sections[3])
            time.sleep(2)
            sections[3].screenshot('docs/screenshots/calendar_heatmap.png')
            print('Captured docs/screenshots/calendar_heatmap.png')

        # Section 5: Model Honesty Box / Scorecard
        if len(sections) > 5:
            driver.execute_script("arguments[0].scrollIntoView();", sections[5])
            time.sleep(1.5)
            sections[5].screenshot('docs/screenshots/scorecard.png')
            print('Captured docs/screenshots/scorecard.png')

        # 4. Generate 1280x640 side-by-side Day/Night Social Preview Image
        print('Generating 1280x640 social preview image...')
        day_img = Image.open('docs/screenshots/hero_day.png')
        night_img = Image.open('docs/screenshots/hero_night.png')

        # Both are 2880x2400 (due to scale factor 2 on 1440x1200)
        # Crop upper 1280px width, 1280px height from each
        # Social preview is 1280x640. So left half = 640x640, right half = 640x640.
        # In retina coordinates (scale factor 2): 1280x1280 each.
        left_crop = day_img.crop((0, 0, 1280, 1280)).resize((640, 640), Image.Resampling.LANCZOS)
        right_crop = night_img.crop((0, 0, 1280, 1280)).resize((640, 640), Image.Resampling.LANCZOS)

        combined = Image.new('RGB', (1280, 640))
        combined.paste(left_crop, (0, 0))
        combined.paste(right_crop, (640, 0))

        # Hairline divider in the center
        from PIL import ImageDraw
        draw = ImageDraw.Draw(combined)
        draw.line([(640, 0), (640, 640)], fill=(38, 38, 38), width=2)

        combined.save('docs/screenshots/social_preview_1280x640.png', quality=95)
        print('Generated docs/screenshots/social_preview_1280x640.png')

    finally:
        driver.quit()

if __name__ == '__main__':
    take_shots()
