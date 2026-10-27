'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    useContentSize: true,
    transparent: true,
    frame: false,
    webPreferences: {
      offscreen: true,
    },
  });

  const svgContent = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.svg'), 'utf-8');
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 512px; height: 512px; background: transparent; overflow: hidden; }
    svg { width: 512px; height: 512px; display: block; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((resolve) => setTimeout(resolve, 800));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const buf = image.toPNG();
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon_512.png'), buf);
  app.quit();
});
