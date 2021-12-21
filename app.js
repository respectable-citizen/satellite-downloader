const Maps = require("./maps");

(async () => {
    for (let zoomLevel = 0; zoomLevel < 22; zoomLevel++) {
        await Maps.downloadZoomLevel(zoomLevel);
    }

    console.log("Finished")
})();