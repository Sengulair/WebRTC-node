const GsmProxyEventHandler = require("./../gsm-proxy-event-handler");

class HandlerUssd extends GsmProxyEventHandler {
    constructor(gsmProxy) {
        super("ussd", gsmProxy);
    }

    async handle(data, tag) {
        const command = data;
        this.gsmProxy.getModem().sendUSSD(command, (result, err) => {
            var rslt = {};
            if (err && Object.keys(err).length > 0) {
                rslt.error = err;
            } else {
                rslt.success = true;
                rslt.tag = tag;
                rslt.data = result;
            }
            this.gsmProxy.onModemEvent("answer", rslt);
        });
    }
}

module.exports = HandlerUssd;
