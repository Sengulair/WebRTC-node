Before installing packages `node-pre-gyp` and Python should be installed on machine

Install packages with npm

Install sox on system: https://www.npmjs.com/package/node-record-lpcm16#dependencies

Firstly you need to configure Google OAuth app in Google Developer Console: https://console.cloud.google.com/apis/credentials
After that create `.env` file based on `.env.example` and fill keys for server

Server:
1. go to server folder
2. run `docker-compose up -d` to create db
3. `npm run migrations` to create basic structure of db
4. run `npm run dev` to start server
5. Open http://localhost:3000/login/google to get accessToken that later will be used in client. (For now token expires in 30 days)

Admin: 
1. Open [admin/admin.html](./admin/admin.html) file in browser
2. Paste accessToken and click create device button. 
3. Copy device Id and token from browser console output

Device:
1. Go to device folder
2. Install all needed dependencies
3. `sudo apt-get install libasound2-dev` for speaker lib
4. Create `.env` file based on `.env.example` and fill keys 
  - Token is token for device that expires in 30 days, paste from admin console log from prev step
  - EXCHANGE_SERVER_WEBSOCKET_URL is url that hosts exchange server and ends with `/device`
  - audiocard index is index of audiointerface connected to audioadapter. You can check index with `aplay -l` command
  - SERIALPORT_PATH - `ls -la /dev/` and check serial ports, probably serial0 is suitable
5. run `npm start`

Client:
1. Open [client/client.html](./client/client.html) file in browser
2. Paste accessToken into field and deviceID
3. Click authorize
4. Now you can see log of device gsm modem and send commands with input
5. Buttons for connect disconnect create WebRTC connection with device to get and send mic/audio


