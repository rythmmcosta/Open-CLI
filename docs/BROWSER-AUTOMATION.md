# Browser Automation — Open CLI "Eyes"

Open CLI includes a full Playwright-powered browser engine. The AI can see, navigate, interact with, and verify any website.

## Setup

```bash
opencli browser install
# Installs Chromium (headless)
```

## Quick Commands

```bash
# Take a screenshot of any URL
opencli browser screenshot https://myapp.com

# Verify a page is working correctly
opencli browser verify https://myapp.com

# Use natural language in REPL
opencli
> navigate to https://myapp.com and check if the login button exists
> take a screenshot of the checkout page
> fill out the contact form and submit it
```

## Built-in Browser Tools

All tools are available to the AI automatically when browsing tasks are detected:

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to URL, returns title/content/links/forms |
| `browser_screenshot` | Full-page or element screenshot |
| `browser_click` | Click element by CSS selector |
| `browser_type` | Type text into form fields |
| `browser_scroll` | Scroll page (up/down/top/bottom) |
| `browser_verify` | Multi-check UI verification with screenshot |
| `browser_extract` | Extract text/attributes from elements |
| `browser_execute` | Run JavaScript in page context |
| `browser_close` | Close browser session |

## Verification System

The `browser_verify` tool runs multiple checks at once and takes a screenshot:

```
Check types:
  exists    — CSS selector exists in DOM
  visible   — Element is visible on screen
  text      — Element contains expected text
  url       — Current URL contains string
  title     — Page title contains string
  clickable — Element has bounding box (is interactive)
  no_errors — No JavaScript console errors
```

### Example verification run

```
> verify all buttons on https://myapp.com work

opencli will:
1. Navigate to the page
2. Take a before screenshot
3. Run checks: buttons exist, buttons are visible, buttons are clickable
4. Check for JS errors
5. Take a after screenshot
6. Report ✓/✗ for each check
```

## Use Cases

### Website Verification After Deploy

```bash
opencli "navigate to https://staging.myapp.com, verify the homepage loads, 
  check the login form has email and password fields, verify the signup button 
  is clickable, and take a full-page screenshot"
```

### Form Testing

```bash
opencli "go to https://myapp.com/contact, fill in name='Test User', 
  email='test@example.com', message='Hello', then submit the form 
  and verify the success message appears"
```

### Web Scraping (via Agent)

```yaml
# Agent: Price Monitor
type: scraper
trigger: cron (hourly)
task: Navigate to https://store.com/product/123, extract the price, 
      compare with yesterday's price in prices.json, 
      alert via notification if price dropped more than 10%
```

### E2E Testing

```bash
opencli --skill testing "write Playwright tests for the signup flow at 
  https://myapp.com and run them"
```

### Visual Regression

```bash
opencli "take a screenshot of https://myapp.com before and after 
  the CSS change and compare them"
```

## Screenshot Location

Screenshots are saved to:
```
~/.config/opencli/screenshots/
```

Format: `screenshot-{timestamp}.png` or `verify-{timestamp}.png`

## Headless Mode

The browser runs headless by default. For debugging, you can use:

```bash
opencli "open https://myapp.com in the browser"
# The AI uses headless mode and shows you the screenshot instead
```

## Tips

- Use `/skill browser-automation` in REPL for AI tuned to browser tasks
- The AI automatically takes screenshots before/after interactions
- CSS selectors like `button[type="submit"]`, `#login-form`, `.nav-link` work well
- For SPAs, add wait: "Wait for the #app element to appear before interacting"
