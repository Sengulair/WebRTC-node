const GsmProxyEventHandler = require("./../gsm-proxy-event-handler");

class HandlerSetModem extends GsmProxyEventHandler {
    constructor(gsmProxy) {
        super("sys-set-modem", gsmProxy);
    }

    async handle(data, tag) {
        try {
            var rslt = {};
            rslt.success = true;
            rslt.tag = tag;
            rslt.data = {};
            this.gsmProxy.onModemEvent("sys", rslt);
            this.gsmProxy.setModemPath(data);
        } catch (error) {
            this.log().error(error);
        }
    }
}

module.exports = HandlerSetModem;
