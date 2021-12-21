const fetch = require("node-fetch");
const fs = require("fs");
const https = require("https");

//Tells fetch to use IPv6, which helps evade bot detection
const httpsAgent = new https.Agent({
    family: 6
});

//Returns cookie which should be sent with request, currently only returns abuse exemption cookie if necessary
function getCookie() {
    if (abuseExemptionCookie) return `GOOGLE_ABUSE_EXEMPTION=${abuseExemptionCookie}`;
    return "";
}

function setAbuseExemptionCookie(cookie) {
    abuseExemptionCookie = cookie;
}

var abuseExemptionCookie;         //When banned, you can do a RECAPTCHA to receive an abuse exemption cookie. This cookie allows you to continue sending requests.
var allMissingTiles = {};         //Stores location of missing tiles at each zoom level, used for optimization. This variable is both populated and required by the downloadZoomLevel function. Each zoom level must be downloaded in order to populate this variable correctly.
var downloadingZoomLevel = false; //Indicates if we are currently downloading a zoom level
var zoomLevelDownloadStartTime;   //Stores the start time of the current zoom level download in milliseconds

const serverNumber = 1;   //Server to request tiles from, doesn't really matter what this is.

async function getTile(x, y, zoom) {
    //let url = `https://khms${serverNumber}.google.com/kh/v=908?x=${x}&y=${y}&z=${zoom}`;  //Endpoint used by actual Google Maps client, it's probably against ToS to use this
    let url = `https://mt${serverNumber}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${zoom}`;        //Official API endpoint to download tiles
    
    let res;
    while (!res) {
        try {
            res = await fetch(url, {
                "headers": {
                    "Accept": "image/avif,image/webp,*/*",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Connection": "keep-alive",
                    "Cookie": getCookie(),
                    //"Host": `khms${serverNumber}.google.com`,
                    "Origin": "https://www.google.com",
                    "Referer": "https://www.google.com/",
                    "Sec-Fetch-Dest": "image",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-site",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:95.0) Gecko/20100101 Firefox/95.0"
                },
                "method": "GET",
                "redirect": "manual", //We get redirected when rate limited, don't follow the redirect so we can examine the response
                "agent": httpsAgent
            });
        } catch(error) {
            console.log("Read the part in the readme about being a caveman.");
        }
    }
    let content = await res.buffer();

    if (res.status == 200) {
        //Got tile, return it
        return {
            tile: content,
            rateLimited: false
        };
    } else if (res.status == 302) {
        if (content.toString().includes("sorry/index")) {
            //We have been rate limited
            return {
                tile: null,
                rateLimited: true
            };
        } else {
            //Redirected but not because we are rate limited, this shouldn't happen
            throw "HTTP status 302 without rate limit!";
        }
    } else if (res.status == 404) {
        //Tile doesn't exist
        return {
            tile: null,
            rateLimited: false
        };
    } else {
        throw `HTTP status: ${res.status}`;
    }
}

async function ensureDirectoryExists(path) {
    try {
        await fs.promises.access(path);
    } catch {
        await fs.promises.mkdir(path);
    }
}

//Checks if tiles at different zoom levels overlap, used for optimization
function checkOverlap(x1, y1, zoom1, x2, y2, zoom2) {
    //Map first coordinates to second zoom
    let bound = (2 ** zoom1) - 1;
    let x1p = x1 / bound;
    let y1p = y1 / bound;

    let mx = Math.floor(x1p * zoom2);
    let my = Math.floor(y1p * zoom2);

    return (mx == x2) && (my == y2);
}

//Both the width and height of the map in terms of tiles
function getSizeFromZoom(zoom) {
    return 2 ** zoom;
}

//Downloads all tiles at a particular zoom level using a given number of threads
async function downloadZoomLevel(zoom, threads = 32) {
    if (Math.log2(threads) % 1 !== 0) throw "Thread count must be power of two";

    for (let zoomLevel = 0; zoomLevel < zoom; zoomLevel++) {
        if (!allMissingTiles[zoomLevel]) {
            try {
                let content = await fs.promises.readFile(`json/${zoomLevel}.json`);
                allMissingTiles[zoomLevel] = JSON.parse(content.toString());
            } catch {
                throw `Missing tiles dictionary isn't populated for zoom level ${zoomLevel}`;
            }
        }
    }

    if (downloadingZoomLevel) throw "Currently downloading zoom level, please wait.";

    downloadingZoomLevel = true;
    console.log(`Downloading zoom level ${zoom}`);
    allMissingTiles[zoom] = [];

    await ensureDirectoryExists("images");
    await ensureDirectoryExists("json");
    await ensureDirectoryExists(`images/${zoom}`);

    let size = getSizeFromZoom(zoom);
    let totalTiles = size ** 2;

    if (threads > totalTiles) threads = totalTiles;
    let tilesPerThread = totalTiles / threads;

    zoomLevelDownloadStartTime = +new Date();
    let threadPromises = [];
    for (let thread = 0; thread < threads; thread++) {
        let start = tilesPerThread * thread;
        let end = (tilesPerThread * (thread + 1)) - 1;

        threadPromises.push(downloadThread(zoom, thread, start, end));
    }

    //Wait for download to finish
    await Promise.all(threadPromises);
    await fs.promises.writeFile(`json/${zoom}.json`, JSON.stringify(allMissingTiles[zoom])); //Save missing tiles to disk

    downloadingZoomLevel = false;
    console.log(`Finished downloading zoom level ${zoom}`);
}

async function downloadThread(zoom, thread, start, end) {
    let size = getSizeFromZoom(zoom);
    let mask = (2 ** zoom) - 1;
    let tiles = (end - start) + 1;
    let missingTiles = [];

    for (let i = start; i <= end; i++) {
        let x = i & mask;
        let y = (i >> zoom) & mask;
        
        //Should we download?
        for (let zoomLevel = 0; zoomLevel < zoom; zoomLevel++) {
            let missingTilesGroup = allMissingTiles[zoomLevel];

            for (let tile of missingTilesGroup) {
                if (checkOverlap(x, y, zoom, tile[0], tile[1], zoomLevel)) continue;
            }
            zoomLevel++;
        }

        let result = await getTile(x, y, zoom);
        if (result.rateLimited) throw "Rate limited!";
        if (result.tile) {
            //Save tile
            await fs.promises.writeFile(`images/${zoom}/${x}_${y}.jpg`, result.tile);
        } else {
            //AAdd tile to missing tiles dictionary
            allMissingTiles[zoom].push([x, y]);
        }

        if (thread == 0 && (i % 5 == 0)) {
            //Progress thread
            let tilesDownloaded = i - start;
            let msSinceStartOfDownload = (+new Date()) - zoomLevelDownloadStartTime;
            let msPerTile = msSinceStartOfDownload / tilesDownloaded;
            let remainingTiles = tiles - tilesDownloaded;
            let msRemaining = remainingTiles * msPerTile;
            let minutesRemaining = msRemaining / 1000 / 60;
            let timeRemaining = "";
            if (isFinite(minutesRemaining)) timeRemaining = `- ${minutesRemaining.toFixed(1)} minutes remaining`;

            let progress = (tilesDownloaded) / tiles;
            progress = (progress * 100).toFixed(2);
            console.log(`${progress}% ${timeRemaining}`);
        }
    }

    return missingTiles;
}

module.exports = {
    getTile,
    setAbuseExemptionCookie,
    downloadZoomLevel
};