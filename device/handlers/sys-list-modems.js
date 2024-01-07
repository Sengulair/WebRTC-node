const GsmProxyEventHandler = require("./../gsm-proxy-event-handler");

class HandlerListModems extends GsmProxyEventHandler {
    constructor(gsmProxy) {
        super("sys-list-modems", gsmProxy);
    }

    async handle(data, tag) {
        try {
            var rslt = {};
            rslt.success = true;
            rslt.tag = tag;
            rslt.data = this.gsmProxy.modemsList;
            this.gsmProxy.onModemEvent("sys", rslt);
        } catch (error) {
            this.log().error(error);
        }
    }
}

module.exports = HandlerListModems;
