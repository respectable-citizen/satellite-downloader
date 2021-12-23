const Maps = require("./maps");

(async () => {
    for (let zoomLevel = 11; zoomLevel < 22; zoomLevel++) {
        await Maps.downloadZoomLevel(zoomLevel, 64);
    }

    console.log("Finished")
})();