# Content Request Dashboard

This is an [Electron](https://electronjs.org) based desktop application for graphing Content Requests from the Ocean Wise Sharepoint server. It is built on and designed for use on an OSX machine and works in that context. It has not yet been tested on other operating systems.

The `src/index.js` file defines how our Electron application/window will function. There are a few helper files and libraries in this project, but the critical file is `src/sprest.js`.

## Sprest.js

This file integrates with Sharepoint. It needs a current Ocean Wise email and password combo entered into the `SP_USER` and `SP_PASS` constants in order to successfully login to the Sharepoint server.

The script passes an XML based login request to the login.microsoftonline.com/extSTS.srf endpoint. It then tries to retrieve a returned security token which will be used to authenticate with our Sharepoint server in order to retrieve some tasty cookies from the `https://vamsc.sharepoint.com/_forms/default.aspx?wa=wsignin1.0` endpoint. It then provides the returned cookies and the server name to the Sharepoint REST library so that we can easily access values on the server!

Once we are logged in the script collects all the items in the 'Content Requests' list and begins to analyze and plot them with the D3 library.
