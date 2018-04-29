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
            if (!that.maxRetry || ++that.retry<that.maxRetry)
                setTimeout(that.connect, 5000);
            else if (that.onError)
                that.onError(that.id,err);
        };

        that.onMsgNotReceived = function() {
            that.timerPing = null;
            that.disconnect();
            that.connect();
        }

        that.onMsgReceived = function(timeout) {
            if (that.timerPing!==null)
                clearTimeout(that.timerPing);
            that.timerPing = setTimeout(that.onMsgNotReceived, timeout*1000);
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
            if (that.timerPing!==null)
                clearTimeout(that.timerPing);
            that.tcpclient.destroy();
            that.tcpclient = null;
            that.devicedl = false;
        }

        that.connect = function(fun) {
            if (that.tcpclient==null) {
                that.tcpclient = new net.Socket();
                that.tcpclient.on('data', function(data) {
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
                                if (res.action.randomid==that.msgidx && res.action.actionclass=="ActionDevicedl") {
                                    if (that.onDevices) {
                                        that.onMsgReceived(120);
                                        that.devicedl = true;
                                        console.log('[TCPC] OnDevices');
                                        that.onDevices(that.id,res);
                                    }
                                }
                                else if (that.devicedl) {
                                    if (res.action.actionclass=="ActionPing")
                                        that.onMsgReceived(120);
                                    else if (that.onMessage) {
                                        //console.log('[TCPC] OnMessage');
                                        that.onMessage(that.id,res.action.actionclass,res);
                                    }
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
                });
                that.tcpclient.on('close', function() {
                    console.log('[TCPC] Connection closed');
                    that.connect();
                });
                that.tcpclient.on('error', that.errorHandler);
                console.log('[TCPC] Connecting to '+that.host+':'+that.port);
                that.tcpclient.connect(that.port, that.host, function() {
                    console.log('[TCPC] Connected');
                    fun = typeof fun === "undefined"?"devicedl":fun
                    if (fun=="devicedl")
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
