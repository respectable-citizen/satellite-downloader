# Google Maps Satellite Downloader

This is a script to download satellite images from Google Maps.

The below mentioned optimization system requires that zoom levels be downloaded in order. `app.js` has a for loop to run through the zoom levels in order. Once you have downloaded up to a specific zoom level, you no longer need to download the lower ones again as the relevant information for optimization is stored in the `json` folder. In other words, the `json` folder will show you the zoom levels you can skip. Skip these zoom levels by editing the initial value in the for loop.

## This has already been done, you monkey.

Ahaha, but do they have my special optimization system that drastically increases download speed? The number of tiles to download increases exponentially the more you zoom in, so with other scripts it is pretty much impossible to get any high level of detail.

## It doesn't work
Did you pump up the number of threads like a power-hungry caveman? The API endpoint we are using limits the number of active connections, so too many threads will start throwing EADDRINUSE errors.
Still broken? Make an issue or something.

## How is this useful?
Okok bear with me here. What if you stitch all the images together to make a giant image of the Earth which you can zoom in on to literally some random guys house? Oh? You need 600GB of RAM to load the image?

Ok, how about this. Put all the images onto a Raspberry Pi or something and code a fancy flight system that will show where you are above the image, uh, and stuff. Imagine how jealous all the cannibals will be when they see you zooming around the skies after society collapses. Just, make it run on hydrogen or something so they don't kill you for using oil.

## How do I convert tile coordinates to actual coordinates?
https://developers.google.com/maps/documentation/javascript/coordinates
https://stackoverflow.com/questions/23457916/how-to-get-latitude-and-longitude-bounds-from-google-maps-x-y-and-zoom-parameter

## What the fuck?
¯\\\_(ツ)_/¯
