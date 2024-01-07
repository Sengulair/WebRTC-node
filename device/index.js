const GsmProxy = require('./gsm-proxy');
const gsmDevice = new GsmProxy();

process.on('SIGINT', function() {
  gsmDevice.destruct();
});

gsmDevice.init();