// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
const redis_client = require('./redisconf');
const Client = require('./clients');
var Config = {};

var expm = {
    "START_TYPE": {
        "m": 7,
        "s": 0,
        "values": {
            "2":"NGROK",
            "0":"GREENLOCK",
            "1":"LOCAL"
        },
        "values2": {
            "NGROK":2,
            "GREENLOCK":0,
            "LOCAL":1
        }
    },
    "RESET_DEV": {
        "m": 1,
        "s": 3,
        "values": {
            "1":"YES",
            "0":"NO"
        },
        "values2": {
            "YES":1,
            "NO":0
        }
    },
    "AUTO_DEV": {
        "m": 1,
        "s": 4,
        "values": {
            "1":"YES",
            "0":"NO"
        },
        "values2": {
            "YES":1,
            "NO":0
        }
    },
    "WELL_KNOWN": {
        "m": 1,
        "s": 5,
        "values": {
            "1":"YES",
            "0":"NO"
        },
        "values2": {
            "YES":1,
            "NO":0
        }
    },
    "AUTOLOGIN": {
        "m": 1,
        "s": 6,
        "values": {
            "1":"YES",
            "0":"NO"
        },
        "values2": {
            "YES":1,
            "NO":0
        }
    }
}

Config.cstr = expm;

Config.getInside = function(nm) {
    if (Config.cstr[nm]) {
        let v = Config.flag;
        let val = (v>>Config.cstr[nm].s)&(Config.cstr[nm].m);
        let vals = ""+val;
        if (Config.cstr[nm].values[vals])
            return Config.cstr[nm].values[vals];
    }
    return "";
}

Config.setInside = function(o) {
    let newv = o;
    for (let i = 1; i+1 < arguments.length; i+=2) {
        let nm = arguments[i];
        let vname = arguments[i+1];
        if (Config.cstr[nm]) {
            if (typeof Config.cstr[nm].values2[vname]!="undefined") {
                let v = Config.cstr[nm].values2[vname];
                newv = (newv&(~(Config.cstr[nm].m<<Config.cstr[nm].s)))|((v&Config.cstr[nm].m)<<Config.cstr[nm].s);
            }
        }
    }
    return newv;
}

Config.__setInside = function() {
    let oldv = Config.flag,oldv2;
    for (let i = 0; i < arguments.length; i++) {
        oldv2 = arguments[i];
        arguments[i] = oldv;
        oldv = oldv2;
    }
    arguments[arguments.length++] = oldv;
    Config.flag = Config.setInside.apply(null,arguments);
    return Config.flag;
}

Config.printConfigFlag = function() {
    console.log("CONFFLAG: ");
    Object.keys(Config.cstr).forEach(function (key) {
        console.log(key+" = "+Config.getInside(key));
    });
}
Config.devPortSmartHome = "3000";
Config.smartHomeProviderGoogleUser = ""; // client id that Google will use
//Config.smartHomeProviderGoogleClientId = "ZxjqWpsYj3"; // client id that Google will use
//Config.smartHomeProvideGoogleClientSecret = "hIMH3uWlMVrqa7FAbKLBoNUMCyLCtv"; // client secret that Google will use
//Config.smartHomeProviderApiKey = "AIzaSyBNZ0MwFCCjPOiB-Zt0NBancTpE5slwQqs"; // client API Key generated on the console
Config.flag = 0;
Config.flag = Config.__setInside("START_TYPE","NGROK",
        "AUTO_DEV","NO","RESET_DEV","YES","WELL_KNOWN","NO","AUTOLOGIN","NO");
Config.smartHomeProvideGoogleClientSecret = '';
Config.smartHomeProviderGoogleClientId = '';
Config.smartHomeProviderApiKey = '<API_KEY>';

function init() {
    if (typeof __argv == "undefined")
        __argv = process.argv;
    __argv.forEach(function(value, i, arr) {
        if (value.includes("smart-home="))
            Config.smartHomeProviderCloudEndpoint = value.split("=")[1];
        else if (value.includes("http-port="))
            Config.devPortSmartHome = value.split("=")[1];
        else if (value.includes("username="))
            Config.smartHomeProviderGoogleUser = value.split("=")[1];
        else if (value.startsWith("-f")) {
            try {
                let nmval = value.substring(2);
                let nmsplit = nmval.split('=');
                Config.__setInside(nmsplit[0],nmsplit[1]);
            } catch (e) {
                conole.log(e.stack);
            }
        }
    });
    if (!Config.smartHomeProviderCloudEndpoint)
        Config.smartHomeProviderCloudEndpoint = "http://localhost:3000";
    exports.devPortSmartHome = Config.devPortSmartHome;
    exports.smartHomeProviderGoogleClientId = Config.smartHomeProviderGoogleClientId;
    exports.smartHomeProvideGoogleClientSecret = Config.smartHomeProvideGoogleClientSecret;
    exports.smartHomeProviderCloudEndpoint = Config.smartHomeProviderCloudEndpoint;
    exports.smartHomeProviderApiKey = Config.smartHomeProviderApiKey;
    exports.smartHomeProviderGoogleUser = Config.smartHomeProviderGoogleUser;
    exports.getInside = Config.getInside;
    exports.setInside = Config.setInside;
    return new Promise(function(resolve,reject) {
        redis_client.on("ready",function() {
            Client.findByUsername(Config.smartHomeProviderGoogleUser).then(
                function(cc) {
                    if (cc && typeof cc == "object") {
                        exports.smartHomeProvideGoogleClientSecret = cc.secret;
                        exports.smartHomeProviderGoogleClientId = cc.stringid;
                        exports.smartHomeProviderApiKey = cc.apikey;
                        console.log("[OK] config: ", exports);
                        Config.printConfigFlag();
                        resolve();
                    }
                    else
                        reject(100);
                }
            ).catch(function(err) {
                console.log("[Err] config: ", Config);
                Config.printConfigFlag();
                reject(err);
            });
        });
    });
}
exports.init = init;
