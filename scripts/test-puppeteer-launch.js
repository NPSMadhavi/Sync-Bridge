import puppeteer from 'puppeteer';

async function test(headlessMode) {
  console.log(`Testing launch with headless: ${JSON.stringify(headlessMode)}...`);
  try {
    const browser = await puppeteer.launch({
      headless: headlessMode,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ]
    });
    console.log(`Success launching with ${headlessMode}! Closing...`);
    await browser.close();
    return true;
  } catch (err) {
    console.error(`Failed launching with ${headlessMode}:`, err.message);
    return false;
  }
}

async function main() {
  const modes = [true, 'shell', 'new'];
  for (const mode of modes) {
    const success = await test(mode);
    if (success) {
      console.log(`Recommended launch mode is: ${mode}`);
      break;
    }
  }
  process.exit(0);
}

main();
