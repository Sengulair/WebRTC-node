const GsmProxyEventHandler = require("./../gsm-proxy-event-handler");

class HandlerCmd extends GsmProxyEventHandler {
    constructor(gsmProxy) {
        super("cmd", gsmProxy);
    }

    async handle(data, tag) {
        this.gsmProxy.getModem().executeCommand(data, (result, err) => {
            var rslt = {};
            if (err && Object.keys(err).length > 0) {
                rslt.error = err;
            } else {
                rslt.success = true;
                rslt.tag = tag;
                rslt.data = result.data;
            }
            this.gsmProxy.onModemEvent("answer", rslt);
        });
    }
}

module.exports = HandlerCmd;
