const tcpclient = require('./tcpclient');
const VERSION = "1.5";
var redis_client = require("./redisconf");
var Auth = require("./datastore").Auth;
var translations = {};
/*var translations = {
  "it": {
    "right": "destra",
    "subtitle": "sottotitolo",
    "power": "accendi",
    "mute": "muto",
    "ffw": "avanti veloce",
    "rec": "registra",
    "v+": "alza volume",
    "ttx": "televideo",
    "back": "indietro",
    "yellow": "tasto giallo",
    "v-": "abbassa volume",
    "down": "basso",
    "exit": "esci",
    "sky":"murdock",
    "p+": "canale successivo",
    "return": "ritorno",
    "tools": "strumenti",
    "blue": "tasto blu",
    "pause": "pausa",
    "manual": "manuale",
    "up": "su",
    "chlist": "lista canali",
    "green": "tasto verde",
    "revw": "indietro veloce",
    "esc": "esci",
    "p-": "canale precedente",
    "guide": "guida",
    "red": "tasto rosso",
    "s201":"spina",
    "magiccube":"cubo",
    "blackbeam1":"fagiolo",
    "av":"sorgente",
    "orvibo1":"cupola",
    "2sky":"satellite",
    "2tv":"televisione",
    "remote":"telecomando",
    "chan":"orso"
  },
  "en": {
    "ffw": "fast forward",
    "rec": "record",
    "v+": "raise volume",
    "v-": "lower volume",
    "p+": "next channel",
    "chlist": "channel list",
    "revw": "rewind",
    "esc": "exit",
    "ttx": "text",
    "p-": "previous channel",
    "s201":"soso",
    "sky":"murdock",
    "magiccube":"cube",
    "blackbeam1":"beam",
    "av":"source",
    "orvibo1":"coco",
    "2sky":"satellite",
    "2tv":"tv",
    "guidatv":"tv guide",
    "interattivi":"interactive",
    "remote":"remote",
    "chan":"bear"
  }
};*/

function editTranslation(lang,renames) {
    let rens = "translation:"+lang;
    let len = 0;
    Object.keys(renames).forEach(function (key) {
        rens += ','+key+','+renames[key];
        len++;
    });
    return new Promise(function(resolve,reject) {
        if (!len)
            resolve();
        else {
            let funcallback = function(err0,res0) {
                if (err0 || res0.indexOf("OK")<0)
                    reject1(err0?err0:9000);
                else
                    resolve();
            }
            eval('redis_client.hmset('+rens+',funcallback);');
        }
    });
}

exports.editTranslation = editTranslation;

function loadTranslations() {
    return new Promise(function(resolve,reject) {
        redis_client.smembers("translations",function(err0,res0) {
            console.log("[loadTrans] arr "+JSON.stringify(res0));
        	if (err0 || !res0 || res0.constructor !== Array || res0.length==0)
        		reject(err0);
        	else {
                var trans = {};
                let okTrans = false;
                let processTrans = function(n) {
                    redis_client.hgetall("translation:"+res0[n],function(err1,res1) {
                        console.log("[loadTrans] tr["+res0[n]+"("+n+")] "+JSON.stringify(res1));
                        if (!err1 && res1) {
                            trans[res0[n]] = res1;
                            okTrans = true;
                        }
                        if (n+1<res0.length)
                            processTrans(n+1);
                        else if (okTrans)
                            resolve(trans);
                        else
                            reject(1500);
                    });
                }
                processTrans(0);
            }
        });
    });
}

//const configuredLocale = "it";

var DBData = {
    /*"1234": {
        "filters" : [
            "blackbeam1:samsung",
            "blackbeam1:sky",
            "orvibo1:general",
            "s201"
        ],
        "orvhost":"mfzhome.ddns.net",
        "orvport":10001,
        "orvretry":0,
        "defaultremote":"blackbeam1:samsung",
        "autologin":true
    }*/
}

function getTranslation(name,loc) {
    if (translations[loc] && translations[loc][name])
        return translations[loc][name];
    else
        return name;
}

function replaceObj(obj, repl) {
    //try {
    if (typeof obj=="object") {
        var out = (obj instanceof Array)?[]:{};
        Object.keys(obj).forEach(function (key) {
            if (obj.hasOwnProperty(key)) {
                out[key] = replaceObj(obj[key],repl);
            }
        });
        return out;
    }
    else if (typeof obj=="string") {
        Object.keys(repl).forEach(function (key) {
            if (repl.hasOwnProperty(key)) {
                if (typeof repl[key]=="number") {
                    if (obj=="$"+key+"$")
                        obj = repl[key];
                    else if (obj.indexOf("$"+key+"$")<0 && obj.indexOf("%"+key+"%")<0)
                        return;
                }
                if (typeof obj=="string")
                    obj = obj.replace(new RegExp('[\\$%]'+key+'[\\$%]','g'),repl[key]);
            }
        });
    }
    return obj;
/*} catch (e) {
    console.log(e.stack);
}*/
}

function replaceRemote(devices,newDevice,newRemote,configuredLocale) {
    var newRemoteNick = getTranslation(newRemote,configuredLocale);
    var newDeviceNick = getTranslation(newDevice,configuredLocale);
    listSync = {};
    for (var i = 0; i<devices.length; i++) {
        let modd = false;
        if (devices[i].properties.deviceInfo.model=="remotenum") {
            if (devices[i].properties.name.nicknames.indexOf(newRemoteNick)>=0) {
                if (devices[i].states.hasOwnProperty("on")) {
                    if (!devices[i].states.on) {
                        devices[i].states.on = true;
                        listSync[devices[i].id] = true;
                    }
                }
                continue;
            }
            else {
                if (devices[i].states.hasOwnProperty("on")) {
                    if (devices[i].states.on) {
                        devices[i].states.on = false;
                        listSync[devices[i].id] = true;
                    }
                }
                if (devices[i].properties.customData["offset"]==0)
                    continue;
            }
        }
        if (devices[i].properties.customData.hasOwnProperty("device"))
            devices[i].properties.customData["device"] = newDevice;
        if (devices[i].properties.customData.hasOwnProperty("devicenick"))
            devices[i].properties.customData["devicenick"] = newDeviceNick;
        if (devices[i].properties.customData.hasOwnProperty("remote"))
            devices[i].properties.customData["remote"] = newRemote;
        if (devices[i].properties.customData.hasOwnProperty("remotenick"))
            devices[i].properties.customData["remotenick"] = newRemoteNick;
    }
    return listSync;
}

function deviceClosure(msg,dev,uid) {
    return function(eventDetail) {
        deviceOnMessage(eventDetail,msg,dev,uid);
    }
}

function getDeviceDbgName(dev) {
    return dev.properties.name.nicknames[0]+" ("+
        dev.properties.deviceInfo.model+"/"+dev.id+")";
}

function deviceOnMessage(eventDetail,msg,dev,uid) {
    console.log("[DevMsg] Event "+msg+" for device "+getDeviceDbgName(dev)+
        " detected: "+JSON.stringify(eventDetail));
    if (msg=="change") {
        try {
            let statesObj;
            if (eventDetail["data"] && (statesObj = JSON.parse(eventDetail.data))) {
                let ud = DBData[uid];
                let cli = ud['client'];
                let listSync = {};
                let currentremote;
                let defRemote;
                let defDevice;
                let defs;
                if (dev.properties.deviceInfo.model=="switch" &&
                    statesObj.hasOwnProperty('on')) {
                    cli.writecmnd("statechange "+dev.properties.customData["device"]+
                    " "+(statesObj.on?"1":"0"));
                    dev.states.on = statesObj.on;
                }
                else if (dev.properties.deviceInfo.model=="remotevol") {
                    if (statesObj['cmd']=='action.devices.commands.BrightnessAbsolute' &&
                        statesObj.hasOwnProperty('brightness')) {
                        currentremote = ud["currentremote"];
                        defs = currentremote.split(':');
                        defRemote = defs[1];
                        defDevice = defs[0];
                        //la luminosita deve rimanere a 50
                        listSync[dev.id] = true;
                        dev.states.on = true;
                        let remoteObj;
                        let remotes = ud["devicetable"].remote;
                        let volk = getRemoteVolumeKey(statesObj.brightness,remoteObj = remotes[defRemote]);
                        if (!volk) {
                            Object.keys(remotes).some(function (remn) {
                                if (remotes.hasOwnProperty(remn)) {
                                    remoteObj = remotes[remn];
                                    volk = getRemoteVolumeKey(statesObj.brightness,remoteObj);
                                    if (volk) {
                                        cli.emitir(remoteObj.device,remoteObj.remote+":"+volk);
                                        return true;
                                    }
                                }
                                return false;
                            });
                        }
                        else
                            cli.emitir(defDevice,defRemote+":"+volk);
                    }
                }
                else if (dev.properties.deviceInfo.model=="remotenum") {
                    currentremote = ud["currentremote"];
                    if (!dev.properties.customData.offset) {
                        currentremote = dev.properties.customData.device+":"+
                            dev.properties.customData.remote;
                    }
                    defs = currentremote.split(':');
                    defRemote = defs[1];
                    defDevice = defs[0];
                    if (statesObj['cmd']=='action.devices.commands.BrightnessAbsolute' &&
                        statesObj.hasOwnProperty("brightness")) {
                        dev.states.brightness = statesObj.brightness;
                        let num = statesObj.brightness+dev.properties.customData.offset;
                        let numdata = ud["devicetable"].remote[defs].numData;
                        if (numdata) {
                            cli.emitir(defDevice,defRemote+":"+numdata.pre+num+numdata.post);
                        }
                    }
                    else if (statesObj['cmd']=='action.devices.commands.OnOff') {
                        if (!statesObj.on)
                            cli.emitir(defDevice,defRemote+":power");
                        dev.states.on = true;
                        if (statesObj.hasOwnProperty('on')) {
                            if (!statesObj.on)
                                listSync[dev.id] = true;
                        }
                    }
                }
                else if (dev.properties.deviceInfo.model=="remotekey") {
                    currentremote = ud["currentremote"];
                    defs = currentremote.split(':');
                    defRemote = defs[1];
                    defDevice = defs[0];
                    let mul = 1;
                    if (statesObj['cmd']=='action.devices.commands.BrightnessAbsolute' && statesObj.hasOwnProperty("brightness")) {
                        dev.states.brightness = statesObj.brightness;
                        mul = statesObj.brightness;
                    }
                    dev.states.on = true;
                    if (statesObj.hasOwnProperty('on')) {
                        if (!statesObj.on)
                            listSync[dev.id] = true;
                    }
                    let key = dev.properties.customData.key;
                    if (key.charAt(0)!='@') {
                        let remotes = ud["devicetable"].remote;
                        let remoteObj = remotes[defRemote];
                        if (remoteObj.keys.indexOf(key)<0) {
                            Object.keys(remotes).some(function (remn) {
                                if (remotes.hasOwnProperty(remn)) {
                                    remoteObj = remotes[remn];
                                    if (remoteObj.keys.indexOf(key)>=0) {
                                        currentremote = remn;
                                        defRemote = remoteObj.remote;
                                        defDevice = remoteObj.device;
                                        return true;
                                    }
                                }
                                return false;
                            });
                        }
                        key = defRemote+":"+key+"#"+mul;
                    }
                    else {
                        let dtitem = ud["devicetable"].sh[dev.properties.customData.device+':'+key.substring(1)];
                        defDevice = dtitem.device;
                        if (dtitem.lastremote) {
                            defRemote = dtitem.lastremote;
                            currentremote = defDevice+":"+defRemote;
                        }
                    }
                    cli.emitir(defDevice,key);
                }
                if (currentremote!=ud["currentremote"]) {
                    console.log("[DevMsg] Changing current remote: "+ud["currentremote"]+"->"+currentremote);
                    ud["currentremote"] = currentremote;
                    Object.assign(listSync, replaceRemote(ud["devices"],defDevice,defRemote,ud.user.options.language));
                }
                Object.keys(listSync).forEach(function (key) {
                    if (listSync.hasOwnProperty(key)) {
                        if (exports.onMod)
                            exports.onMod(uid,ud["devices"][parseInt(key)]);
                    }
                });
            }
        }
        catch (e) {
            console.log(e.stack);
        }
    }
}

function cloneFromTemplate(templ, repl) {
    let obj = replaceObj(templ, repl);
    if (obj.id=="0") cloneFromTemplate.nicks = {};
    let nicks = cloneFromTemplate.nicks;
    let n0 = obj.properties.name.nicknames[0];
    //console.log("[CloneTemp] N0 "+n0+" "+JSON.stringify(nicks));
    if (nicks.hasOwnProperty(n0)) {
        nicks[n0].num++;
        if (nicks[n0].first) {
            nicks[n0].first.properties.name.nicknames[0] += " 1";
            nicks[n0].first = null;
        }
        obj.properties.name.nicknames[0]+=" "+nicks[n0].num;
    }
    else {
        nicks[n0] = {
            "first":obj,
            "num":1
        };
    }
    return obj;
}

function processDeviceDl(uid,objdata){
    var ud = DBData[uid];
    var ds = createDeviceTable(objdata,ud.user);
    ud["devicetable"] = ds;
    let configuredLocale = ud.user.options.language;
    var devices = [];
    var volumeNeeded = false;
    var keyDevices = {"power":0};
    let defaultremote = ud.user.options.defaultremote;
    if (defaultremote.length==0) {
        ud.filters.some(function(key) {
            if (key.indexOf(':')>0) {
                defaultremote = key;
                return true;
            }
            else
                return false;
        });
        if (defaultremote.length==0) {
            Object.keys(ds.remote).some(function(key) {
                if (ds.remote[key].filtered) {
                    defaultremote = key;
                    return true;
                }
                else
                    return false;
            });
        }
    }
    var defs = defaultremote.split(':');
    var defRemote = "";
    var defDevice = "";
    if (defs.length==2) {
        defRemote = defs[1];
        defDevice = defs[0];
    }
    var defRemoteNick = getTranslation(defRemote,configuredLocale);
    var defDeviceNick = getTranslation(defDevice,configuredLocale);
    var obj,repl = {};
    ud.user.options.defaultremote = ud["currentremote"] = defaultremote;
    ud["nicks"] = {};
    console.log("[ProcessDevDl] Ecco 1 "+defRemoteNick+"/"+defDeviceNick);
    Object.keys(ds.remote).forEach(function (key) {
        let rn;
        if (ds.remote.hasOwnProperty(key) && (rn = ds.remote[key]).filtered) {
            repl = {
                "didx":devices.length,
                "device":rn["device"],
                "devicenick":rn["devicenick"],
                "remote":rn["remote"],
                "remotenick":rn["remotenick"],
                "version":VERSION
            };
            //console.log("[ProcessDevDl] Ecco 2 "+JSON.stringify(repl));

            if (rn.volumekeys.length)
                volumeNeeded = true;
            var regnum = rn.numData!=null?
                new RegExp(rn.numData.pre+"[0-9]+"+rn.numData.post):null;
            console.log("[ProcessDevDl] Ecco 2 ");
            obj = cloneFromTemplate(remoteNumTemplate,repl);
            console.log("[ProcessDevDl] Ecco 3 "+JSON.stringify(obj));
            devices.push(obj);
            for (var i = 0; i<rn.keys.length; i++) {
                var kn = rn.keys[i];
                if ((regnum!=null && regnum.exec(kn)) || keyDevices.hasOwnProperty(kn))
                    continue;
                keyDevices[kn] = devices.length;
                repl.didx = devices.length;
                repl.keynick = rn.keysnick[i];
                repl.key = kn;
                repl.remote = defRemote;
                repl.device = defDevice;
                repl.devicenick = defDeviceNick;
                repl.remotenick = defRemoteNick;
                devices.push(obj = cloneFromTemplate(remoteKeyTemplate,repl));
                if (mulKeyRegexp.exec(kn))
                    obj.properties.traits.push('action.devices.traits.Brightness');
                console.log("[ProcessDevDl] Ecco 4 "+JSON.stringify(obj));
            }
        }
    });
    if (volumeNeeded) {
        repl.version = VERSION;
        repl.didx = devices.length;
        repl.remote = defRemote;
        repl.remotenick = defRemoteNick;
        repl.device = defDevice;
        repl.devicenick = defDeviceNick;
        devices.push(obj = cloneFromTemplate(remoteVolumeTemplate,repl));
        console.log("[ProcessDevDl] Ecco 5 "+JSON.stringify(obj));
    }
    repl.version = VERSION;
    repl.remote = defRemote;
    repl.remotenick = defRemoteNick;
    repl.device = defDevice;
    repl.chan = getTranslation("chan",configuredLocale);
    repl.devicenick = defDeviceNick;
    for (var i = 0; i<9; i++) {
        repl.didx = devices.length;
        repl.offset = 100+i*100;
        devices.push(obj = cloneFromTemplate(remoteBigNumTemplate,repl));
        console.log("[ProcessDevDl] Ecco 5.1 "+JSON.stringify(obj));
    }
    replaceRemote(devices,defDevice,defRemote,ud.user.options.language);
    Object.keys(ds.sh).forEach(function (key) {
        var rn;
        if (ds.sh.hasOwnProperty(key) && ds.sh[key].filtered) {
            var rn = ds.sh[key];
            repl = {
                "didx":devices.length,
                "device":rn["device"],
                "devicenick":rn["devicenick"],
                "remote":defRemote,
                "remotenick":defRemoteNick,
                "key":rn["key"],
                "keynick":rn["keynick"],
                "version":VERSION
            };
            devices.push(obj = cloneFromTemplate(remoteKeyTemplate,repl));
            console.log("[ProcessDevDl] Ecco 6 "+JSON.stringify(obj));
        }
    });
    Object.keys(ds.switch).forEach(function (key) {
        if (ds.switch.hasOwnProperty(key) && ds.switch[key].filtered) {
            repl = {
                "didx":devices.length,
                "device":key,
                "devicenick":ds.switch[key].devicenick,
                "version":VERSION
            };
            devices.push(obj = cloneFromTemplate(remoteSwitchTemplate,repl));
            console.log("[ProcessDevDl] Ecco 7 "+JSON.stringify(obj));
        }
    });
    let olddevices;
    if (exports.onRemove && (olddevices = ud["devices"])) {
        olddevices.forEach(function(dev,idx){
            dev.wait = true;
            let es = ud.events[dev.id];
            if (es) {
                es.close();
                es.onmessage = null;
                es.onerror = null;
                es.removeAllListeners('change');
            }
            exports.onRemove(uid,dev);
        });
    }
    ud["devices"] = devices;
    ud["events"] = {};
    if (exports.onAdd) {
        devices.forEach(function(dev,idx){
            if (idx==devices.length-1)
                dev.wait = false;
            else
                dev.wait = true;
            var es = exports.onAdd(uid,dev);
            ud.events[dev.id] = es;
            es.onmessage = deviceClosure("message",dev,uid);
            es.onerror = deviceClosure("error",dev,uid);
            es.addEventListener('change',deviceClosure("change",dev,uid));
        });
    }
}

function doRun(uid,command) {
    return command;
}
exports.doRun = doRun;

function processMessage(uid,msg,res) {
    try {
        console.log("[ProcessMessage] "+msg+" "+JSON.stringify(res));
        let dev,ud,devices;
        if ((dev = res["action"]["device"]) && (ud = DBData[uid]) && (devices = ud["devices"])) {
            let devname = dev.name;
            if (msg=="ActionNotifystate" || msg=="ActionStateon" || msg=="ActionStateon" || msg=="ActionStatechange") {
                if (dev.type=="DeviceS20") {
                    devices.some(function(d) {
                        if (d.properties.deviceInfo.model=="switch" &&
                            d.properties.customData["device"]==devname) {
                            let st = dev.state==1;
                            if (st!=d.states.on) {
                                d.states.on = st;
                                if (exports.onMod)
                                    exports.onMod(uid,d);
                                console.log("Change on device "+JSON.stringify(d));
                            }
                            return true;
                        }
                        return false;
                    });
                }
            }
            //mettere a off tutte le key della stessa device
            //mettere a on le key presente di questa device
            //mettere a running il remoteNum relativo al telecomando usato
            if (msg=="ActionEmitir") {
                devices.forEach(function(d) {
                    var modd = false;
                    if (d.properties.deviceInfo.model=="remotenum" && d.properties.customData["offset"]==0) {
                        var newrunning = d.properties.customData["device"]==devname;
                        if (d.states.on!=newrunning)
                            modd = true;
                    }
                    else if (d.properties.deviceInfo.model=="remotekey") {
                        if (d.states.on)
                            modd = true;
                        d.states.on = false;
                    }
                    else if (d.properties.deviceInfo.model=="remotevol") {
                        if (d.states.on)
                            modd = true;
                        d.states.on = false;
                    }
                    var newkeys = [];
                    var lastNum = "";
                    res["action"]["irname"].forEach(function(k) {
                        var effectivename = "",idx;
                        var effectiveremote = "";
                        var effectivenum = 1;
                        var remoteObj;
                        var insert = true;
                        if (k.charAt(0)=='@') {
                            effectivename = k;
                        }
                        else if (k.charAt(0)!='$' && (idx = k.indexOf(':'))>0 && idx<k.length-1) {
                            var kks = k.split(':');
                            evvectivename = kks[1]
                            effectiveremote = kks[0];
                        }
                        if ((idx = effectivename.indexOf('#'))>0 && idx<effectivename.length-1)  {
                            effectivenum = parseInt(effectivename.substring(idx+1));
                            effectivename = effectivename.substring(0,idx);
                        }
                        if ((remoteObj = ud["devicetable"].remote[devname+':'+effectiveremote]) &&
                            remoteObj.numData && remoteObj.numData.pre.length==0 &&
                            remoteObj.numData.post.length==0) {
                            if (/^[0-9]+$/.exec(effectivename)) {
                                if (lastNum.length) {
                                    newkeys[nnewkeys.length-1].name+=effectivename;
                                    lastNum = newkeys[nnewkeys.length-1];
                                    insert = false;
                                }
                            }
                            else {
                                lastNum = "";
                            }
                        }
                        if (insert && effectivename.length)
                            newkeys.push({
                                "name":effectivename,
                                "num":effectivenum,
                                "remote":effectiveremote
                            });
                    });
                    newkeys.forEach(function(k) {
                        if (d.properties.deviceInfo.model=="remotenum" && d.properties.customData["device"]==devname &&
                            d.properties.customData["remote"]==k.remote) {
                            var offset;
                            if ((offset = d.properties.customData["offset"])==0)
                                d.states.on = true;
                            modd = true;
                            var remoteObj;
                            if ((remoteObj = ud["devicetable"].remote[devname+':'+k.remote]) &&
                                remoteObj.numData) {
                                var reg = new RegExp(remoteObj.pre+"([0-9]+)"+remoteObj.post);
                                var m = reg.exec(k.name);
                                if (m) {
                                    var num = parseInt(m[1]);
                                    if (num>offset && num<offset+100) {
                                        d.states.brightness = num-offset;
                                        d.states.on = true;
                                    }
                                }
                            }
                            console.log("Change on device "+JSON.stringify(d));
                        }
                        else if (d.properties.deviceInfo.model=="remotekey" &&
                            d.properties.customData["key"]==k.name) {
                            d.states.on = true;
                            modd = true;
                            console.log("Change on device "+JSON.stringify(d));
                        }
                        else if (d.properties.deviceInfo.model=="remotevol") {
                            var m = remoteVolumeRegexp.exec(k.name);
                            if (m) {
                                d.states.on = true;
                                modd = true;
                                idx = ((m[2]=='-'?-1:1)*parseInt(m[1])*k.num)+50;
                                d.states.brightness = idx;
                            }
                            console.log("Change on device "+JSON.stringify(d));
                        }
                    });
                    if (modd && exports.onMod)
                        exports.onMod(uid,d);
                });
            }
        }
        let conn;
        if (ud && (conn = ud['conn']) && res) {
            console.log("[OnMessage] WRITING EVENT");
            conn.write('event: orvmsg\n');
            conn.write('data: ' + JSON.stringify({'pld':res,'msg':'orvmsg'}) + '\n\n');
        }
    }
    catch (e) {
        console.log(e.stack);
    }
}

function configureModule(onAdd,onMod,onRemove,doAutoLogin) {
    exports.onAdd = onAdd;
    exports.onMod = onMod;
    exports.onRemove = onRemove;
    let al = function() {
        return Auth.getAutologinUsers().then(function (users) {
            users.forEach(function(us) {
                console.log("[ConfigureModule] Trying to autologin "+us.uid);
                doAutoLogin(us.uid);
            });
        });
    }
    return loadTranslations().then(function(trans) {
        translations = trans;
        console.log("[TRANS ok] "+JSON.stringify(trans));
        if (doAutoLogin)
            return al();
    }).catch(function(err) {
        translations = {"it": {},"en":{}};
        console.log("[TRANS fail] "+err);
        if (doAutoLogin)
            return al();
    });
}
exports.configureModule = configureModule;
exports.onAdd = null;
exports.onMod = null;
exports.onRemove = null;

function initUserDevices(user,test,force) {
    let ud = {},cli = null;
    let uid = user.uid;
    if (typeof test=="undefined")
        test = false;
    if (test || !(ud = DBData[uid]) || !(cli = ud['client']) || force) {
        if (cli)
            cli.disonnect();
        cli = new tcpclient.MFZClient(uid,user.options.orvhost,user.options.orvport,user.options.orvretry);
        if (!test) {
            DBData[uid] = {'user':user,'client':cli};
            cli.setOnError(function(uid,err) {
                let conn,ud;
                if ((ud = DBData[uid]) && (conn = ud['conn'])) {
                    conn.write('event: conmsg\n');
                    conn.write('data: ' + JSON.stringify({'msg':'conmsg','pld':'Connection error '+err}) + '\n\n');
                }
            });
            cli.setOnDevices(processDeviceDl);
            cli.setOnMessage(processMessage);
            cli.connect();
        }
        else {
            cli.maxRetry = 3;
            console.log("CONNECTING TEMP "+user.options.orvhost+':'+user.options.orvport);
            return cli.promise("devicedl").then(function(obj) {
                try {
                    cli.disconnect();
                    let out = createTestDataBundle(obj.obj,user);
                    console.log('Connected is '+(DBData[uid] && DBData[uid]["client"]));
                    return {'connected':(DBData[uid] && DBData[uid]["client"])!=null,'dev':out};
                }
                catch (err) {
                    if (err.stack)
                        console.log(err.stack);
                    else
                        console.log(err);
                    throw err;
                }
            }, function(uid) {
                cli.disconnect();
                throw uid;
            });
        }
    }
    else if (ud['client']) {
        ud["client"].writecmnd("devicedl");
    }
    return null;
}

exports.initUserDevices = initUserDevices;

/*function testConnection(usercp) {
    return initUserDevices(usercp,true).then(function (deviceTable) {
        //"idx":0,"name":"samsung","filtered":true,"device":"blackbeam1","default":true,"keys":[],"shs":[]
        let ret = [];
        let idx = 0;
        let shsbydev = {};
        Object.keys(deviceTable.remote).forEach(function (key) {
            ret.push(Object.assign({
                "idx":idx++,
                "type":"r",
                "defalut":usercp.options.defaultremote==key
            },deviceTable.remote[key]));
        });
        Object.keys(deviceTable.sh).forEach(function (key) {
            let item,sh;
            if (!(item = shsbydev[(sh = deviceTable.sh[key]).device]))
                item = shsbydev[sh.device] = {
                    "devicenick":sh.devicenick,
                    "device":sh.device,
                    "remote":'@'+sh.device,
                    "remotenick":'@'+sh.devicenick,
                    "keys":[],
                    "keysraw":[],
                    "keysnick":[],
                    "filtered":sh.filtered,
                    "type":"h",
                    "defalut":false
                };
            item.keysraw.push(sh.shraw);
            item.keys.push(sh.key);
            item.keysnick.push(sh.keynick);
        });
        Object.keys(deviceTable.switch).forEach(function (key) {
            ret.push({
                "idx":idx++,
                "defalut":false,
                "device":key,
                "remote":key,
                "type":"s",
                "devicenick":deviceTable.switch[key].devicenick,
                "remotenick":deviceTable.switch[key].devicenick,
                "filtered":deviceTable.switch[key].filtered
            });
        });
        return ret;
    });
}

exports.testConnection = testConnection;*/

function createTestDataBundle(obj,user) {
    var devices = [];
    var h;
    if (obj && obj.action && (h = obj.action.hosts)) {
        //console.log("[DeviceTable] Ecco 0 "+(typeof userData)+" "+userData);
        let filters = user.options.filters;
        let configuredLocale = user.options.language;
        let remoteAdded = {};
        let shAdded = {};
        Object.keys(h).forEach(function (key) {
            if (h.hasOwnProperty(key)) {
                var dev = h[key];
                var devname = key;
                let devnick = getTranslation(devname,configuredLocale);
                let add = {
                    "type":"d",
                    "remote":"",
                    "remotenick":"",
                    "idx":devices.length,
                    "device":devname,
                    "devicenick":devnick,
                    "filtered":false,
                    "default":false,
                    "items":null,
                    "raw":""
                };
                devices.push(add);
                if (dev.type=="DeviceCT10" || dev.type=="DeviceAllOne" || dev.type=="DeviceRM") {
                    add.type+="r"+dev.type.substring(6);
                    add.items = [];
                    for (var i = 0; i<dev.dir.length; i++) {
                        var key = dev.dir[i];
                        var kks = key.split(':');
                        var rn;
                        var kn;
                        if (kks.length>=2) {
                            if (!remoteAdded[rn = devname+':'+kks[0]]) {
                                add.items.push(remoteAdded[rn] = {
                                    "type":"r1",
                                    "remote":kks[0],
                                    "remotenick":getTranslation(kks[0],configuredLocale),
                                    "idx":add.items.length,
                                    "device":devname,
                                    "devicenick":devnick,
                                    "filtered":filters.indexOf(rn)>=0,
                                    "default":user.options.defaultremote==rn,
                                    "items":[],
                                    "raw":""
                                });
                            }
                            kn = kks[1];
                            remoteAdded[rn].items.push({
                                "type":"k1",
                                "remote":kn,
                                "remotenick":getTranslation(kn,configuredLocale),
                                "idx":remoteAdded[rn].items.length,
                                "device":kks[0],
                                "devicenick":getTranslation(kks[0],configuredLocale),
                                "filtered":remoteAdded[rn].filtered,
                                "default":false,
                                "items":null,
                                "raw":kks.length>=3?kks[2]:""
                            });
                        }
                    }
                    for (var i = 0; i<dev.sh.length; i++) {
                        var key = dev.sh[i];
                        var kks = key.split(':');
                        if (kks.length>=2) {
                            let shn = kks[0].substr(1);
                            let kn = devname+":"+kks[0];
                            if (!shAdded[devname]) {
                                add.items.push(shAdded[devname] = {
                                    "type":"r2",
                                    "remote":"@sh",
                                    "remotenick":"@sh",
                                    "idx":add.items.length,
                                    "device":devname,
                                    "devicenick":devnick,
                                    "filtered":false,
                                    "default":false,
                                    "items":[],
                                    "raw":""
                                });
                            }
                            if (!shAdded[kn]) {
                                var m = shChannelRegexp.exec(shn);
                                //console.log("[DeviceTable] Ecco 5 "+shn+ " "+m);
                                var shnick = m?
                                    getTranslation(m[2].replace(/_/g,' '),configuredLocale):
                                    getTranslation(shn,configuredLocale);
                                shAdded[devname].items.push(shAdded[kn] = {
                                    "type":"k2",
                                    "remote":kks[0],
                                    "remotenick":shnick,
                                    "idx":shAdded[devname].items.length,
                                    "device":devname,
                                    "devicenick":devnick,
                                    "filtered":true,
                                    "default":false,
                                    "items":{},
                                    "raw":""
                                });
                            }

                            if (kks.length>2) {
                                let lastremote = kks[1];
                                let newfiltered = filters.indexOf(devname+":"+lastremote)>=0;
                                if (shAdded[kn].filtered)
                                    shAdded[kn].filtered = newfiltered;
                                shAdded[kn].items[lastremote] = true;
                            }
                            shAdded[kn].raw+=(shAdded[kn].raw.length?"|":"")+key.substring(key.indexOf(':')+1);
                        }
                    }
                }
                else if (dev.type=="DeviceS20") {
                    add.type+="s"+dev.type.substring(6);
                    let filt = filters.indexOf(devname+':onoff')>=0;
                    add.items = [{
                        "type":"r3",
                        "remote":"onoff",
                        "remotenick":"onoff",
                        "idx":0,
                        "device":devname,
                        "devicenick":devnick,
                        "filtered":filt,
                        "default":false,
                        "items":[
                            {
                                "type":"k3",
                                "remote":"switchon",
                                "remotenick":getTranslation("switchon",configuredLocale),
                                "idx":0,
                                "device":devname,
                                "devicenick":devnick,
                                "filtered":filt,
                                "default":false,
                                "items":null,
                                "raw":""
                            },
                            {
                                "type":"k3",
                                "remote":"switchoff",
                                "remotenick":getTranslation("switchoff",configuredLocale),
                                "idx":1,
                                "device":devname,
                                "devicenick":devnick,
                                "filtered":filt,
                                "default":false,
                                "items":null,
                                "raw":""
                            }
                        ],
                        "raw":""
                    }];
                }
            }
        });
    }
    console.log("[createTestDataBundle] "+JSON.stringify(devices));
    return devices;
}

function createDeviceTable(obj,user) {
    var devices = {
        "remote":{},
        "switch":{},
        "sh":{}
    };
    var h;
    if (obj && obj.action && (h = obj.action.hosts)) {
        //console.log("[DeviceTable] Ecco 0 "+(typeof userData)+" "+userData);
        let filters = user.options.filters;
        let configuredLocale = user.options.language;
        console.log("[DeviceTable] Ecco 1 "+JSON.stringify(Object.keys(h)));
        Object.keys(h).forEach(function (key) {
            if (h.hasOwnProperty(key)) {
                var dev = h[key];
                var devname = key;
                console.log("[DeviceTable] Ecco 2 "+devname+" "+dev.type);
                if (dev.type=="DeviceCT10" || dev.type=="DeviceAllOne" || dev.type=="DeviceRM") {

                    var numDatas = {};
                    for (var i = 0; i<dev.dir.length; i++) {
                        var key = dev.dir[i];
                        var kks = key.split(':');
                        var rn;
                        var kn;
                        var insert = true;
                            //console.log("[DeviceTable] Ecco 2.1 "+kks[0]+":"+kks[1]);
                        if (kks.length>=2) {
                            //console.log("[DeviceTable] Ecco 2.2 "+kks[0]+":"+kks[1]+" "+JSON.stringify(devices));
                            if (!devices.remote[rn = devname+':'+kks[0]]) {
                                devices.remote[rn] = {
                                    "keys":[],
                                    "keysraw":[],
                                    "filtered": filters.indexOf(devname+":"+rn)>=0,
                                    "remote": kks[0],
                                    "keysnick":[],
                                    "numData":null,
                                    "device":devname,
                                    "devicenick":getTranslation(devname,configuredLocale),
                                    "remotenick":getTranslation(kks[0],configuredLocale),
                                    "volumekeys":[],
                                    "volumekeysraw":[]
                                };
                                numDatas[rn] = {};
                            }
                            kn = kks[1];
                            console.log("[DeviceTable] Ecco 3 "+rn+"/"+kn);
                            var m = remoteNumRegexp.exec(kn);
                            if (m) {
                                var key2 = m[1]+":"+m[3]
                                if (!numDatas[rn][key2])
                                    numDatas[rn][key2] = 0;
                                numDatas[rn][key2]++;
                            }
                            else {
                                m = remoteVolumeRegexp.exec(kn);
                                if (m) {
                                    devices.remote[rn].volumekeys.push(kn);
                                    if (kks.length>=3)
                                        devices.remote[rn].volumekeysraw.push(kks[2]);
                                    insert = false;
                                }
                            }
                            if (insert) {
                                devices.remote[rn].keys.push(kn);
                                devices.remote[rn].keysnick.push(getTranslation(kn,configuredLocale));
                                if (kks.length>=3)
                                    devices.remote[rn].keysraw.push(kks[2]);
                            }
                        }
                    }
                    console.log("[DeviceTable] Ecco 4 "+JSON.stringify(numDatas));
                    Object.keys(numDatas).forEach(function (rn) {
                        var maxprefix = 0;
                        var realPrefix = "";
                        var np = numDatas[rn];
                        Object.keys(np).forEach(function (key2) {
                            if (np.hasOwnProperty(key2)) {
                                if (maxprefix<np[key2]) {
                                    maxprefix = np[key2];
                                    realPrefix = key2;
                                }
                            }
                        });
                        if (maxprefix) {
                            var kks = realPrefix.split(":");
                            devices.remote[rn].numData = {"pre":kks[0],"post":kks[1]};
                        }
                    });
                    for (var i = 0; i<dev.sh.length; i++) {
                        var key = dev.sh[i];
                        var kks = key.split(':');
                        if (kks.length>=2) {
                            var shn = kks[0].substr(1),shkey = devname+':'+shn;
                            var lastremote = kks.length>2?kks[1]:"";
                            let shraw = '';
                            let newfiltered = kks.length<=2 || filters.indexOf(devname+":"+lastremote)>=0;
                            if (typeof devices.sh[shkey]!="undefined") {
                                if (newfiltered)
                                    newfiltered = devices.sh[shkey].filtered;
                                shraw = devices.sh[shkey].shraw+'|';
                                if (!lastremote.length)
                                    lastremote = devices.sh[shkey].lastremote;
                            }
                            shraw+=key.substring(key.indexOf(':')+1);
                            var m = shChannelRegexp.exec(shn);
                            //console.log("[DeviceTable] Ecco 5 "+shn+ " "+m);
                            var shnick = m?
                                getTranslation(m[2].replace(/_/g,' '),configuredLocale):
                                getTranslation(shn,configuredLocale);
                            devices.sh[shkey] = {
                                "device":devname,
                                "filtered":newfiltered,
                                "shraw":shraw,
                                "lastremote":lastremote,
                                "key":'@'+shn,
                                "devicenick":getTranslation(devname,configuredLocale),
                                "keynick":shnick
                            };
                        }
                    }
                }
                else if (dev.type=="DeviceS20") {
                    devices.switch[devname] = {
                        "filtered": filters.indexOf(devname)>=0,
                        "devicenick": getTranslation(devname,configuredLocale)
                    };
                }
            }
        });
    }
    console.log("[DeviceTable] "+JSON.stringify(devices));
    return devices;
}

var remoteVolumeRegexp = /^v([0-9]*)([\+\-])$/; //var m = /^v([0-9]*)([\+\-])/.exec('v+'); m[1] m[2] (o m null)

var remoteNumRegexp = /^([^0-9]*)([0-9]+)([^\+\-]*)$/;

var shChannelRegexp = /^[a-z]_([0-9]+)_(.*)$/;

var mulKeyRegexp = /^(set|exit|av|[^\+\-]+[\+\-])$/;

function convertNumber(num,remoteObj) {
    if (remoteObj.numData.pre.length || remoteObj.numData.post.length) {
        if (remoteObj.keys.indexOf(remoteObj.numData.pre+num+remoteObj.numData.post)>=0)
            return remoteObj.numData.pre+num+remoteObj.numData.post;
        else
            return null;
    }
    else {
        if (num.length==4 && num.charAt(1)=="2")//baco google home/assistant
            return num.substr(1);
        else
            return num;
    }
}

function manageRawChanges(uid,newraws) {
    let ud,cli,resolve,reject;
    let prom = new Promise(function(res0,rej0) {
        resolve = res0;
        reject = rej0;
    });
    let completed = [];
    let arrprocess = Object.keys(newraws);
    if (!arrprocess.length)
        resolve(completed);
    else if ((ud = DBData[uid]) && (cli = ud['client'])) {
        let atleastOne = false;
        let manageResult = function(n) {
            if (n+1<arrprocess.length)
                processRaw(n+1);
            else if (atleastOne)
                resolve(completed);
            else
                reject(completed);
        }
        let processRaw = function(n) {
            let rawk = arrprocess[n];
            let rawv = newraws[rawk];
            let rev = /([^:]+):([^:]+):([^:]+)/.exec(rawk);
            if (rev) {
                let p1;
                if (rev[3].charAt(0)=='@')
                    p1 = rev[3];
                else
                    p1 = rev[2]+':'+rev[3];
                cli.promise('editraw '+rev[1]+' '+p1+" "+rawv)
                .then(function(out) {
                    if (out.retval==1)
                        atleastOne = true;
                    completed.push({'key':rawk,'rv':out.retval});
                    manageResult(n);
                }).catch(function(out) {
                    completed.push({'key':rawk,'rv':700});
                    manageResult(n);
                });
            }
            else
                manageResult(n);
        }
        processRaw(0);
    }
    else
        reject(null);
}
exports.manageRawChanges = manageRawChanges;

function setSiteConnection(uid,conn) {
    let ud,cli;
    console.log("[SetSiteConnection] "+uid);
    if ((ud = DBData[uid]) && (cli = ud['client'])) {
        ud['conn'] = conn;
        return true;
    }
    else
        return false;
}
exports.setSiteConnection = setSiteConnection;

function getRemoteVolumeKey(brightn,remoteObj) {
    if (!remoteObj)
        return null;
    var intval = parseInt(brightn)-50;
    var volk = "";
    if (intval<0) {
        intval = -intval;
        if (remoteObj.volumekeys.indexOf(volk = "v"+intval+"-")<0)
            volk = "v-";
        else
            return volk;
    }
    else {
        if (intval==0)
            intval = 1;
        if (remoteObj.volumekeys.indexOf(volk = "v"+intval+"+")<0)
            volk = "v+";
        else
            return volk;
    }
    return remoteObj.volumekeys.indexOf(volk)>=0?volk+"#"+intval:null;
}

var remoteVolumeTemplate =  {
    "properties" : {
        "type": "action.devices.types.LIGHT",
        "traits": [
          "action.devices.traits.OnOff",
          'action.devices.traits.Brightness'
        ],
        "name": {
          "defaultNames": [
            "Smart Light"
          ],
          "name": "volume",
          "nicknames": [
            "volume"
          ]
        },
        "willReportState": false,
        "roomHint": "",
        "deviceInfo": {
          "manufacturer": "MFZ",
          "model": "remotevol",
          "swVersion": "$version$",
          "hwVersion": "1.1"
        },
        "customData": {
          "remote":"$remote$",
          "device":"$device$"
        }
    },
    "states" : {
        "on":false,
        "online":true,
        "brightness": 50
    },
    "nameChanged": false,
    "id": "%didx%",
    "wait":true
};

var remoteBigNumTemplate =  {
    "properties" : {
        "type": "action.devices.types.LIGHT",
        "traits": [
          "action.devices.traits.OnOff",
          'action.devices.traits.Brightness'
        ],
        "name": {
          "defaultNames": [
            "Smart Light"
          ],
          "name": "r$didx$",
          "nicknames": [
            "%offset%"
          ]
        },
        "willReportState": false,
        "roomHint": "",
        "deviceInfo": {
          "manufacturer": "MFZ",
          "model": "remotenum",
          "swVersion": "$version$",
          "hwVersion": "1.1"
        },
        "customData": {
          "remote":"$remote$",
          "device":"$device$",
          "offset":"$offset$"
        }
    },
    "states" : {
        "on":false,
        "online":true,
        "brightness": 50
    },
    "nameChanged": false,
    "id": "%didx%",
    "wait":true
};

var remoteNumTemplate =  {
    "properties" : {
        "type": "action.devices.types.LIGHT",
        "traits": [
          "action.devices.traits.OnOff",
          'action.devices.traits.Brightness'
        ],
        "name": {
          "defaultNames": [
            "Smart Light"
          ],
          "name": "r$didx$",
          "nicknames": [
            "$remotenick$"
          ]
        },
        "willReportState": false,
        "roomHint": "",
        "deviceInfo": {
          "manufacturer": "MFZ",
          "model": "remotenum",
          "swVersion": "$version$",
          "hwVersion": "1.1"
        },
        "customData": {
          "remote":"$remote$",
          "device":"$device$",
          "offset":0
        }
    },
    "states" : {
        "on":false,
        "online":true,
        "brightness": 50
    },
    "nameChanged": false,
    "id": "%didx%",
    "wait":true
};

/*var remoteNumTemplate = {
    "properties": {
        "type": "action.devices.types.THERMOSTAT",
        "traits": [
            "action.devices.traits.StartStop",
            "action.devices.traits.TemperatureSetting"
        ],
        "name": {
            "defaultNames": [
                "Smart Thermostat"
            ],
            "name": "t$didx$",
            "nicknames": [
                "$remotenick$"
            ]
        },
        "willReportState": false,
        "roomHint": "hallway",
        "deviceInfo": {
            "manufacturer": "Smart Home Provider",
            "model": "remotenum",
            "swVersion": "$version$",
            "hwVersion": "1.1"
        },
        "attributes": {
            "thermostatTemperatureUnit": "C"
        },
        "customData": {
            "remote": "$remote$",
            "device": "$device$"
        },
        "id": "%didx%"
    },
    "states" : {
        "thermostatTemperatureSetpoint": 1,
        "online":true,
        "isRunning":false
    },
    "nameChanged": false
};*/

var remoteKeyTemplate =  {
    "properties" : {
        "type": "action.devices.types.LIGHT",
        "traits": [
          "action.devices.traits.OnOff",
        ],
        "name": {
          "defaultNames": [
            "Smart Light"
          ],
          "name": "K$didx$",
          "nicknames": [
            "$keynick$"
          ]
        },
        "willReportState": false,
        "roomHint": "",
        "deviceInfo": {
          "manufacturer": "MFZ",
          "model": "remotekey",
          "swVersion": "$version$",
          "hwVersion": "1.1"
        },
        "customData": {
          "key": "$key$",
          "remote":"$remote$",
          "device":"$device$"
        }
    },
    "states" : {
        "on":false,
        "online":true
    },
    "nameChanged": false,
    "id": "%didx%",
    "wait":true
};

var remoteSwitchTemplate =  {
    "properties": {
        "type": "action.devices.types.LIGHT",
        "traits": [
          "action.devices.traits.OnOff",
        ],
        "name": {
          "defaultNames": [
            "Smart Light"
          ],
          "name": "S$didx$",
          "nicknames": [
            "$devicenick$"
          ]
        },
        "willReportState": false,
        "roomHint": "",
        "deviceInfo": {
          "manufacturer": "MFZ",
          "model": "switch",
          "swVersion": "$version$",
          "hwVersion": "1.1"
        },
        "customData": {
          "device":"$device$"
        }
    },
    "states" : {
        "on":false,
        "online":true
    },
    "nameChanged": false,
    "id": "%didx%",
    "wait":true
};
