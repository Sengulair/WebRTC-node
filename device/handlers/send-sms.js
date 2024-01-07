const GsmProxyEventHandler = require("./../gsm-proxy-event-handler");

class HandlerSms extends GsmProxyEventHandler {
    constructor(gsmProxy) {
        super("sms", gsmProxy);
    }

    async handle(data, tag) {
        const number = data.number;
        const message = data.message;
        this.gsmProxy
            .getModem()
            .sendSMS(number, message, false, (result, err) => {
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

module.exports = HandlerSms;
