const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');
const rimraf = require('rimraf');

function createTempDir() {
    const tempDir = `./temp_${new Date().getTime()}`;
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    return tempDir;
}

function deleteTempDir(dir) {
    try {
        rimraf.sync(dir);
    } catch (err) {
        console.error(`Error al eliminar el directorio temporal: ${err}`);
    }
}

async function startBrowser() {
    const configFile = fs.readFileSync('config.json');
    const config = JSON.parse(configFile);

    const tempDir = createTempDir();

    const puppeteerOptions = {
        headless: false,
        args: ['--disable-setuid-sandbox', '--no-sandbox', '--disable-cache'],
        userDataDir: tempDir
    };

    if (config.proxy.enabled) {
        puppeteerOptions.args.push(`--proxy-server=${config.proxy.url}`);
    }

    
    const browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();


    if (config.geolocation) {
        await page.setGeolocation({
            latitude: config.geolocation.latitude,
            longitude: config.geolocation.longitude,
            accuracy: config.geolocation.accuracy
        });
    }

    if (config.disableWebRTC) {
        await page.evaluateOnNewDocument(() => {
            const disableWebRTC = () => {
                const w = window;
                w.RTCPeerConnection = w.webkitRTCPeerConnection = null;
                w.RTCSessionDescription = w.webkitRTCSessionDescription = null;
                w.RTCIceCandidate = w.webkitRTCIceCandidate = null;
            };
            disableWebRTC();
        });
    }

    
    if (config.manageCookies && config.manageCookies.enabled) {
        // Cargar cookies
        if (config.manageCookies.loadCookies) {
            const cookies = JSON.parse(fs.readFileSync(config.manageCookies.loadCookies));
            await page.setCookie(...cookies);
        }
    
        // Guardar cookies al finalizar
        const cookies = await page.cookies();
        fs.writeFileSync(config.manageCookies.saveCookies, JSON.stringify(cookies));
    }
    

    await page.setViewport({
        width: config.screenDimensions.width,
        height: config.screenDimensions.height
    });

    await page.setUserAgent(config.browserVersion);

    if (config.proxy.enabled && config.proxy.username && config.proxy.password) {
        await page.authenticate({
            username: config.proxy.username,
            password: config.proxy.password
        });
    }

    return { page, browser, tempDir };
}

async function navigateUrl(url) {
    const { page, browser, tempDir } = await startBrowser();
    await page.goto(url);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("Presiona 'q' para salir y limpiar.");

    rl.on('line', async (input) => {
        if (input.toLowerCase() === 'q') {
            console.log("Saliendo y limpiando...");
            await browser.close();
            deleteTempDir(tempDir);
            rl.close();
            process.exit(0); // Sale del proceso
        }
    });
}

navigateUrl('https://www.google.com');
