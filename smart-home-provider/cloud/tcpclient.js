var net = require('net');
const config = require('./config-provider');

var MFZClient = (function(){

    var MFZClient = function (id,host,port,retry) {
        var that = this;
        that.id = id;
        that.tcpclient = null;
        that.port = port || 10000;
        that.host = host || "127.0.0.1";
        that.maxRetry = retry || 0;
        that.retry = 0;
        that.timerPing = null;
        that.currentOut = "";
        that.lastMsgTs = 0;
        that.msgidx = 6859;
        that.devicedl = false;
        that.errorHandler = function(err) {
            console.log("[TCPC] "+err);
            that.tcpclient.destroy();
            that.tcpclient = null;
            that.devicedl = false;
            if (that.onError)
                that.onError(that.id,err);
        };

        that.onMsgNotReceived = function() {
            console.log("[CLI onMsgNotReceived] calling disconnect timerping "+that.timerPing);
            that.timerPing = null;
            let oldretry = that.retry;
            that.disconnect();
            that.retry = oldretry;
            that.onclose(true);
        }

        that.onMsgReceived = function(timeout) {
            console.log("[CLI onMsgReceived]");
            if (that.timerPing!==null)
                clearTimeout(that.timerPing);
            that.timerPing = setTimeout(that.onMsgNotReceived, timeout*1000);
        }

        that.currentPromise = null;
        that.promise = function(str,timeout) {
            if (that.currentPromise)
                return that.currentPromise.promise;
            else {
                timeout = timeout || 30;
                timeout*=1000;
                that.currentPromise = {};
                that.currentPromise.msg = str;
                that.currentPromise.promise = new Promise(function(resolve,reject) {
                    that.currentPromise.resolve = resolve;
                    that.currentPromise.reject = reject;
                    that.currentPromise.timer = setTimeout(function() {
                        console.log("[CLI PROM] calling disconnect");
                        that.disconnect();
                        that.currentPromise = null;
                        reject(that.id);
                    },timeout);
                    that.writecmnd(str);
                });
                return that.currentPromise.promise;
            }
        }

        that.onDevices = null;
        that.setOnDevices = function(fun) {
            that.onDevices = fun;
        }

        that.onMessage = null;
        that.setOnMessage = function(fun) {
            that.onMessage = fun;
        }

        that.onError = null;
        that.setOnError = function(fun) {
            that.onError = fun;
        }

        that.disconnect = function() {
            console.log('[TCPC] Disconnect called');
            if (that.timerPing!==null) {
                clearTimeout(that.timerPing);
                that.timerPing = null;
            }
            that.safelyDestroy();
            that.devicedl = false;
            that.retry = 0;
        }

        that.safelyDestroy = function() {
            if (that.tcpclient) {
                that.tcpclient.removeListener('data', that.ondata);
                that.tcpclient.removeListener('close', that.onclose);
                that.tcpclient.removeListener('error', that.errorHandler);
                that.tcpclient.destroy();
                that.tcpclient = null;
            }
        }

        that.onclose = function(force) {
            console.log("[TCPC] Connection Onclose");
            let f = (typeof force=="boolean")?force:false;
            if (that.timerPing!==null)
                clearTimeout(that.timerPing);
            if (that.tcpclient || f) {
                console.log("[TCPC] Connection closed maxretry: "+that.maxRetry+" retry: "+that.retry+" force: "+f);
                if (that.maxRetry==0 || (++that.retry<that.maxRetry)) {
                    console.log("[TCPC Err] R "+that.retry+"/"+that.maxRetry);
                    that.safelyDestroy();
                    that.timerPing = setTimeout(that.connect, 5000);
                }
                else {
                    if (that.currentPromise) {
                        clearTimeout(that.currentPromise.timer);
                        that.currentPromise.reject(that.id);
                        that.currentPromise = null;
                    }
                    console.log("[CLI OnClose] Calling disconnect maxretry: "+that.maxRetry+" retry: "+that.retry+" force: "+f)
                    that.disconnect();
                }
            }
        }
        that.ondata = function(data) {
            if (!that.currentPromise)
                that.retry = 0;
            var ts = Date.now();

            that.currentOut+=data.toString();
            if (that.currentOut.charAt(that.currentOut.length-1)=='\n') {
                try {
                    data = that.currentOut;
                    //console.log('[TCPC] Received: ' + data);
                    that.currentOut = "";
                    that.lastMsgTs = 0;
                    var res = JSON.parse(data);
                    if (res && res.action) {
                        let msg = "",strmsg;
                        if ((strmsg = res.action.actionclass) && strmsg.length>7) {
                            msg = strmsg.charAt(6).toLowerCase() + strmsg.slice(7);
                        }
                        console.log("[TCPC] strmsg "+strmsg+" msg "+msg+" prom "+
                            (that.currentPromise?that.currentPromise.msg:"undefined"));
                        if (res.action.randomid==that.msgidx && strmsg=="ActionDevicedl") {
                            if (that.onDevices) {
                                that.onMsgReceived(120);
                                that.devicedl = true;
                                console.log('[TCPC] OnDevices');
                                that.onDevices(that.id,res);
                            }
                        }
                        else if (that.devicedl) {
                            if (strmsg=="ActionPing")
                                that.onMsgReceived(120);
                            else if (that.onMessage) {
                                //console.log('[TCPC] OnMessage');
                                that.onMessage(that.id,strmsg,res);
                            }
                        }
                        if (that.currentPromise &&
                            that.currentPromise.msg==msg) {
                            clearTimeout(that.currentPromise.timer);
                            that.currentPromise.resolve({
                                uid: that.id,
                                action: strmsg,
                                obj: res
                            });
                            that.currentPromise = null;
                            that.retry = 0;
                        }
                    }
                }
                catch (e) {
                    //console.trace();
                }
            }
            else if (that.lastMsgTs && ts-that.lastMsgTs>2000) {
                that.currentOut = "";
                that.lastMsgTs = 0;
            }
        }

        that.connect = function(fun) {
            console.log("[TCPC] Connect called");
            if (that.tcpclient==null) {
                console.log("[TCPC] Connect starting");
                that.tcpclient = new net.Socket();
                that.tcpclient.on('data', that.ondata);

                that.tcpclient.on('close', that.onclose);
                that.tcpclient.on('error', that.errorHandler);
                console.log('[TCPC] Connecting to '+that.host+':'+that.port);
                that.tcpclient.connect(that.port, that.host, function() {
                    console.log('[TCPC] Connected');
                    fun = typeof fun === "undefined"?"devicedl":fun
                    if (fun.startsWith("devicedl"))
                        that.onMsgReceived(25);
                    that.writecmnd(fun);
                });
            }
        }
        that.writecmnd = function(cmnd) {
            if (!that.tcpclient)
                that.connect(cmnd);
            else {
                let msg;
                that.msgidx++;
                that.tcpclient.write(msg = '@'+that.msgidx+' '+cmnd+'\r\n');
                console.log("[TCPC] writing "+msg);
            }
        }
        that.emitir = function(device,keys) {
            if (!(keys instanceof Array))
                keys = [keys];
            var strkey = "emitir "+device;
            for (var i = 0; i<keys.length; i++) {
                strkey+=" "+keys[i];
            }
            that.writecmnd(strkey);
        };
    };
    return MFZClient;
})();

exports.MFZClient = MFZClient;
/*function tcpclient_dl() {
    return new Promise(function(resolve,reject) {
        var tcpclient = new net.Socket();
        var port = config.orvdroidPort || 10000;
        var host = config.orvdroidHost || "127.0.0.1";
        var maxRetry = config.orvdroidRetry || 0;
        var retry = 0;
        var errorHandler = function(err) {
            console.log(err);
            tcpclient.destroy();
            if (!maxRetry || ++retry<maxRetry)
                setTimeout(tcpclient_init, 5000);
            else
                reject(err);
        };

        tcpclient.on('data', function(data) {
            console.log('Received: ' + data);
            try {
                var res = JSON.parse(data);
                if (res && res.action && res.action.randomid==6589 && res.action.actionclass=="ActionDevicedl") {
                    tcpclient.removeListener('error', errorHandler);
                    tcpclient.destroy(); // kill client after server's response
                    resolve(res);
                    return;
                }
            }
            catch (e) {
            }
            reject(data);
        });

        tcpclient.on('close', function() {
            console.log('Connection closed');
        });

        tcpclient.connect(port, host, function() {
            console.log('Connected');
            tcpclient.write('@6589 devicedl\r\n');
        });

        tcpclient.on('error', errorHandler);
    });
}*/
