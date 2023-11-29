Before installing packages node-pre-gyp and Python should be installed on machine

Install packages with npm

Install sox on system: https://www.npmjs.com/package/node-record-lpcm16#dependencies

Run packages in strict order to test node peers:
1. `npm run start:signaling` - opens WebSocket server to exchange data for establishing WebRTC connection
2. `npm run start:receiver` - runs receiver peer on Node.js
3. `npm run start:transmitter` - runs transmitter peer on Node.js

index.html needed for testing in browser. Can be receiver and transmitter.
1. `npm run start:signaling`
2. Run node script
- For receiver: Click Start in index.html and then `npm run start:transmitter`
- For transmitter: `npm run start:receiver` and click start and call in index.html