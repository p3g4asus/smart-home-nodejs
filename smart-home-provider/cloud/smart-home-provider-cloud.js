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
const config = require('./config-provider');


const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const fetch = require('node-fetch');
const morgan = require('morgan');
const ngrok = require('ngrok');
const session = require('express-session');

// internal app deps
const google_ha = require('../smart-home-app');
const datastore = require('./datastore');
const orv = require('./orvparams');
const authProvider = require('./auth-provider');

function cloudInit() {
    const User = require('./users');
    // Check that the API key was changed from the default
    if (config.smartHomeProviderApiKey === '<API_KEY>') {
        console.warn('You need to set the API key in config-provider.\n' +
            'Visit the Google Cloud Console to generate an API key for your project.\n' +
            'https://console.cloud.google.com\n' +
            'Exiting...');
        process.exit();
    }
    app.use(morgan('dev'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.set('trust proxy', 1); // trust first proxy
    app.use(session({
        genid: function(req) {
            return datastore.Auth.genRandomString();
        },
        secret: 'xyzsecret',
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false
        }
    }));

    const deviceConnections = {};
    const requestSyncEndpoint = 'https://homegraph.googleapis.com/v1/devices:requestSync?key=';

    /**
     * auth method
     *
     * required headers:
     * - Authorization
     *
     * TODO: Consider using the "cors" module (https://github.com/expressjs/cors) to
     *       simplify CORS responses.
     * TODO: Consider moving auth checks into its own request handler/middleware
     *       (http://expressjs.com/en/guide/writing-middleware.html)
     */
    app.post('/smart-home-api/auth', function(request, response) {
        let uid;
        if (uid = authProvider.checkAuth(request,response,'/login',false)) {
            let us = datastore.Auth.userobj[uid];
            datastore.registerUser(uid, us.tokens['refresh'].s);
            if (config.getInside("AUTO_DEV")=="YES")
                orv.initUserDevices(us,false,true);
            response.status(200)
                .set({
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                })
                .send({
                    success: true
                });
        }
    });

    /**
     * Can be used to register a device.
     * Removing a device would be supplying the device id without any traits.
     *
     * requires auth headers
     *
     * body should look like:
     * {
     *   id: <device id>,
     *   properties: {
     *      type: <>,
     *      name: {},
     *      ...
     *   },
     *   state: {
     *      on: true,
     *      ...
     *   }
     * }
     */
    app.post('/smart-home-api/register-device', function(request, response) {

        let uid;
        if (!(uid = authProvider.checkAuth(request,response,'/login',true)))
            return;

        let device = request.body;
        datastore.registerDevice(uid, device);

        let registeredDevice = datastore.getStatus(uid, [device.id]);
        //console.log("[GETSTATUSOUT/REGDEVICE] "+JSON.stringify(registeredDevice));
        if (!registeredDevice || !registeredDevice[device.id]) {
            response.status(401).set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }).json({
                error: "failed to register device"
            });
            return;
        }

        /*if (device.hasOwnProperty("wait"))
          console.log("[RegDevice] device "+device.id+" wait "+device.wait);*/

        if (!device.hasOwnProperty("wait") || !device.wait)
            app.requestSync(uid);

        // otherwise, all good!
        response.status(200)
            .set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            })
            .send(registeredDevice);
    });

    /**
     * Can be used to reset all devices for a user account.
     */
    app.post('/smart-home-api/reset-devices', function(request, response) {

        let uid;
        if (!(uid = authProvider.checkAuth(request,response,'/login',true)))
            return;

        let device = request.body;
        // Only complete the reset if this is enabled.
        // If the developer disables this, the request will succeed without doing anything.
        if (config.getInside("RESET_DEV")=="YES") {
            datastore.resetDevices(uid);

            // Resync for the user
            app.requestSync(uid);
        }

        // otherwise, all good!
        response.status(200)
            .set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            })
            .send(datastore.getUid(uid));
    });

    /**
     * Can be used to unregister a device.
     * Removing a device would be supplying the device id without any traits.
     */
    app.post('/smart-home-api/remove-device', function(request, response) {

        let uid;
        if (!(uid = authProvider.checkAuth(request,response,'/login',true)))
            return;

        let device = request.body;
        datastore.removeDevice(uid, device);

        let removedDevice = datastore.getStatus(uid, [device.id]);
        if (removedDevice[device.id]) {
            response.status(500).set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }).json({
                error: "failed to remove device"
            });
            return;
        }
        if (!device.hasOwnProperty("wait") || !device.wait)
            app.requestSync(uid);

        // otherwise, all good!
        response.status(200)
            .set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            })
            .send(datastore.getUid(uid));
    });

    /**
     * Can be used to modify state of a device, or to add or remove a device.
     * Removing a device would be supplying the device id without any traits.
     *
     * requires auth headers
     *
     * body should look like:
     * {
     *   id: <device id>,
     *   type: <device type>,
     *   <trait name>: <trait value>,
     *   ...
     * }
     */
    app.post('/smart-home-api/exec', function(request, response) {

        let uid;
        if (!(uid = authProvider.checkAuth(request,response,'/login',true)))
            return;

        let executedDevice = app.smartHomeExec(uid, request.body);
        if (!executedDevice || !executedDevice[request.body.id]) {
            response.status(500).set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }).json({
                error: "failed to exec device"
            });
            return;
        }

        if (request.body.nameChanged) {
            console.log("calling request sync from exec to update name");
            app.requestSync(uid);
        }

        // otherwise, all good!
        response.status(200)
            .set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            })
            .send(executedDevice);
    });

    app.post('/smart-home-api/execute-scene', function(request, response) {

        let uid;
        if (!(uid = authProvider.checkAuth(request,response,'/login',true)))
            return;

        reqdata = request.body;
        data = {
            requestId: reqdata.requestId,
            uid: uid,
            auth: datastore.Auth.userobj[uid].tokens['access'].s,
            commands: reqdata.inputs[0].payload.commands
        };

        return google_ha.registerAgent.exec(data, response);
    });

    app.post('/jsonoptions',function(request,response) {
        let uid;

        if (uid = authProvider.checkAuth(request,response,'/options',false)) {
            let user = datastore.Auth.userobj[uid];
            console.log("[jsonoptions post] tp = " + (typeof request.body)+" cn = "+JSON.stringify(request.body));
            let b = request.body;
            let differences = false;
            if (b.user.host && user.options.orvhost != b.user.host) {
                user.options.orvhost = b.user.host;
                differences = true;
            }
            if (b.user.port && user.options.orvport != b.user.port) {
                user.options.orvport = b.user.port;
                differences = true;
            }
            if (user.options.autologin != b.user.autologin) {
                user.options.autologin = b.user.autologin;
                differences = true;
            }
            if (b.user.language && user.options.language != b.user.language) {
                user.options.language = b.user.language;
                differences = true;
            }

            let filt = user.options.filters;
            Object.keys(b.actions.filtered).forEach(function(k) {
                let isfilt = b.actions.filtered[k];
                let index = filt.indexOf(k);
                if (!isfilt) {
                    if (index > -1) {
                        filt.splice(index, 1);
                        differences = true;
                    }
                }
                else {
                    if (index<0) {
                        filt.push(k);
                        differences = true;
                    }
                }
            });
            let sendOut = function(rep,stat,exitv) {
                console.log("[sendout] "+stat+"_"+exitv)
                rep.status(stat).send({"result":exitv});
            }
            if (b.actions.default && b.actions.default.length && user.options.defaultremote != b.actions.default) {
                user.options.defaultremote = b.actions.default;
                differences = true;
            }
            let manageUser = function() {
                return differences?user.saveOptions().then(function(us) {
                    orv.conMessage(uid,'User change OK: '+JSON.stringify(us),1);
                    orv.initUserDevices(us,false,true);
                    return user;
                }):Promise.resolve(user);
            }
            manageUser()
            .then(function(us) {
                return orv.editTranslation(uid,b.user.language,b.actions.renames);
            }).then(function(out) {
                orv.manageRawChanges(uid,b.actions.raw).catch(function(err) {
                    orv.conMessage(uid,'Edit raw error: '+JSON.stringify(err),null);
                });
                sendOut(response,200,0);
            }).catch(function(err) {
                orv.conMessage(uid,'Something went wrong: '+err,null);
                sendOut(response,200,err);
            });

        }
    });

    app.get('/emitkey', function(request, response) {
        let uid;
        if (uid = authProvider.checkAuth(request,response,'/options',false)) {
            let q = request.query;
            console.log('[emitkey] '+JSON.stringify(q));
            if (q && q.type && q.device && q.key && q.remote) {
                let rv = orv.processEmitRequest(uid,q.type,q.device,q.remote,q.key);
                response.status(200).send({"exitv": rv});
            }
            else
                response.status(200).send({"exitv": 1})
        }
    });

    app.post('/learnkey', function(request, response) {
        let uid;
        if (uid = authProvider.checkAuth(request,response,'/options',false)) {
            let q = request.body;
            console.log('[learnkey] '+JSON.stringify(q));
            if (q && q.device && q.lst && q.lst.length && q.device.length) {
                let rv = orv.processLearnRequest(uid,q.device,q.lst);
                response.status(200).send({"exitv": rv});
            }
            else
                response.status(200).send({"exitv": 1})
        }
    });

    app.post('/createsh', function(request, response) {
        let uid;
        if (uid = authProvider.checkAuth(request,response,'/options',false)) {
            let q = request.body;
            if (q && q.device && q.lst && q.lst.length && q.device.length && q.name && q.name.length) {
                let rv = orv.processShRequest(uid,q.device,q.name,q.lst);
                response.status(200).send({"exitv": rv});
            }
            else
                response.status(200).send({"exitv": 1})
        }
    });

    app.get('/jsonoptions', function(request, response) {
        // console.log('post /smart-home-api/status');

        let uid;

        if (uid = authProvider.checkAuth(request,response,'/options',false)) {
            let user = datastore.Auth.userobj[uid];
            let usercp = new User(user);
            if (request.query && request.query['host'] && request.query['port']) {
                usercp.options.orvhost = request.query['host'];
                usercp.options.orvport = request.query['port'];
            }
            orv.initUserDevices(usercp,true,false).then(function(ret) {
                usercp['connected'] = ret['connected'];
                response.status(200)
                    .set({
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                    })
                    .send({"user":usercp,"devices":ret['dev']});
            }).catch(function(err) {
                response.status(500).set({
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }).json({"user":usercp,"devices":null});
            });
        }
    });

    /**
     * This is how to query.
     *
     * req body:
     * [<device id>,...] // (optional)
     *
     * response:
     * {
     *   <device id>: {
     *     <trait name>: <trait value>,
     *     <trait name>: <trait value>,
     *     <trait name>: <trait value>,
     *     ...
     *   },
     *   <device id>: {
     *     <trait name>: <trait value>,
     *     <trait name>: <trait value>,
     *     <trait name>: <trait value>,
     *     ...
     *   },
     * }
     */
    app.post('/smart-home-api/status', function(request, response) {
        // console.log('post /smart-home-api/status');

        let uid;
        if (!(uid = authProvider.checkAuth(request,response,'/login',true)))
            return;

        let devices = app.smartHomeQuery(uid, request.body);

        if (!devices) {
            response.status(500).set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }).json({
                error: "failed to get device"
            });
            return;
        }

        // otherwise, all good!
        //console.log("[SENDSTATUS] ");
        //console.log(devices);
        response.status(200)
            .set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            })
            .send(devices);
    });

    app.get('/siteconnection/:uid', function(request, response) {
        const uid = request.params.uid.substring(1);
        console.log('get /siteconnection/' + uid);
        if (orv.setSiteConnection(uid,response)) {
            response.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            response.connection.setTimeout(0);
            response.on('close', function() {
                orv.setSiteConnection(uid,null);
            });
        }
        else
            response.status(403).json({
                error: "invalid param"
            });
    });

    /**
     * Creates an Server Send Event source for a device.
     * Called from a device.
     */
    app.get('/smart-home-api/device-connection/:deviceId', function(request, response) {
        const deviceId = request.params.deviceId;
        // console.log('get /smart-home-api/device-connection/' + deviceId);
        deviceConnections[deviceId] = response;

        response.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        response.connection.setTimeout(0);
        response.on('close', function() {
            delete deviceConnections[deviceId];
        });
    });

    app.get('/checkuser', function(req, resp) {
        let us = req.query['us'];
        if (!us) {
            resp.status(403).json({
                error: "invalid param"
            });
        }
        else {
            User.usernameTaken(us).then(function(taken) {
                if (taken) {
                    resp.status(406).set({
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                    }).json({
                        error: "Already taken"
                    });
                }
                else {
                    resp.status(200).set({
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                    })
                    .send({
                        success: true
                    });
                }
            });
        }
    });

    // frontend UI
    app.set('jsonp callback name', 'cid');
    app.get('/getauthcode', function(req, resp) {
        const util = require('util');

        /* forbid caching to force reload of getauthcode */
        resp.set('Cache-Control', 'no-store, must-revalidate');
        /* set correct mime type else browser will refuse to execute the script*/
        let json = false;
        if (req.query.hasOwnProperty('json') && !isNaN(json = parseInt(req.query.json)) && json!=0)
            json = true;
        let redir = '/frontend';
        if (req.query.hasOwnProperty('redirect_uri') && req.query.redirect_uri.length)
            redir = req.query.redirect_uri;
        resp.set('Content-Type', json?'application/json':'text/javascript');
        let path = util.format('/login?client_id=%s&redirect_uri=%s&state=%s',
            config.smartHomeProviderGoogleClientId, encodeURIComponent(redir), 'cool_jazz');
        let code = 0;
        let send = null;
        if (!req.session.user) {
            code = json?400:'&err=400';
        } else {
            let accesscode;
            let authCode;
            if (json && !(accesscode = req.query["code"] ? req.query.code : req.body["code"])) {
                code = json?402:'&err=402';
                console.error('[getauthcode] no access code');
            }
            else if (json && !(authCode = datastore.Auth.authcodes[accesscode])) {
                code = json?401:'&err=401';
                console.error('[getauthcode] expired code');
            }
            else if (json && new Date(authCode.expiresAt) < Date.now()) {
                code = json?403:'&err=403';
                console.error('[getauthcode] expired code');
            }
            else {
                send = json?{
                        AUTH_TOKEN : req.session.user.tokens['access'].s,
                        USERNAME: req.session.user.username
                    }:
                    'var AUTH_TOKEN = "' + req.session.user.tokens['access'].s + '";' +
                    'var USERNAME = "' + req.session.user.username + '";';
                code = 200;
            }
        }
        if (!send) {
            if (!json)
                send = '(function(){window.location.replace("' + path +code+ '");})();';
            else
                send = {'redir':path};
        }
        resp.status(json?code:200).send(send);
    });
    if (config.getInside("WELL_KNOWN")=="YES")
        app.use('/.well-known', express.static("../htdocs/.well-known"));
    app.use('/frontend', express.static('./frontend'));
    app.use('/frontend/', express.static('./frontend'));
    app.use('/', express.static('./frontend'));

    app.smartHomeSync = function(uid) {
        // console.log('smartHomeSync');
        let devices = datastore.getStatus(uid, null);
        // console.log('smartHomeSync devices: ', devices);
        return devices;
    };

    app.smartHomePropertiesSync = function(uid) {
        // console.log('smartHomePropertiesSync');
        let devices = datastore.getProperties(uid, null);
        // console.log('smartHomePropertiesSync devices: ', devices);
        return devices;
    };

    app.smartHomeQuery = function(uid, deviceList) {
        // console.log('smartHomeQuery deviceList: ', deviceList);
        if (!deviceList || deviceList == {}) {
            // console.log('using empty device list');
            deviceList = null;
        }
        let devices = datastore.getStatus(uid, deviceList);
        //console.log('smartHomeQuery devices: '+JSON.stringify(devices));
        return devices;
    };

    app.smartHomeQueryStates = function(uid, deviceList) {
        // console.log('smartHomeQueryStates deviceList: ', deviceList);
        if (!deviceList || deviceList == {}) {
            // console.log('using empty device list');
            deviceList = null;
        }
        let devices = datastore.getStates(uid, deviceList);
        // console.log('smartHomeQueryStates devices: ', devices);
        return devices;
    };

    app.smartHomeExec = function(uid, device) {
        // console.log('smartHomeExec', device);
        // qui avviene l'esecuzione vera e propria. i parametri del comando inviato sono negli states della device
        // quando smartHomeDeviceExec viene chiamato senza dover eseguire niente ci sono pure le properties
        // Questa funzione va chiamata per aggiungere il device nel datastore specificando le properties
        if (device["states"] && !device["properties"]) {
            //esegui
        }
        console.log('smartHomeExec predevice', JSON.stringify(device));
        datastore.execDevice(uid, device);
        let executedDevice = datastore.getStatus(uid, [device.id]);
        console.log('smartHomeExec executedDevice', JSON.stringify(executedDevice));
        return executedDevice;
    };

    app.changeState = function(command) {
        return new Promise(function(resolve, reject) {
            if (command.type == 'change') {
                for (let deviceId in command.state) {
                    const deviceChanges = command.state[deviceId];
                    // console.log('>>> changeState: deviceChanges', deviceChanges);

                    const connection = deviceConnections[deviceId];
                    if (!connection) {
                        // console.log('>>> changeState: connection not found for', deviceId);
                        return reject(new Error('Device ' + deviceId + ' unknown to Amce Cloud'));
                    }

                    // console.log('>>> sending changes to device', deviceId, deviceChanges);
                    connection.write('event: change\n');
                    connection.write('data: ' + JSON.stringify(deviceChanges) + '\n\n');
                }
                resolve();
            } else if (command.type == 'delete') {
                reject(new Error('Device deletion unimplemented'));
            } else {
                reject(new Error('Unknown change type "' + command.type + '"'));
            }
        });
    };

    app.autoLogin = function(uid) {
        //fech login
        //document.querySelector('[name="redirect_uri"]').value = params.get('redirect_uri');
        //document.querySelector('[name="client_id"]').value = params.get('client_id');
        //document.querySelector('[name="redirect_uri"]').value = params.get('redirect_uri');
        //document.querySelector('[name="state"]').value = params.get('state');
        //document.querySelector('[name="username"]').value = document.querySelector('paper-input[name="paper_username"]').value;
        //document.querySelector('[name="password"]').value = document.querySelector('paper-input[name="paper_password"]').value;
        //document.querySelector('#loginform').submit();
        let us;
        if (!(us = datastore.Auth.userobj[uid]))
            return;
        var querystring = require('querystring');
        var postobj = {
            'redirect_uri': '/frontend',
            'client_id': config.smartHomeProviderGoogleClientId,
            'state': 'mfz_over',
            'username': us.username,
            'password2': us.password
        };
        var post_data = querystring.stringify(postobj);

        // Set up the request
        var authCode = null;
        var cookie = '';
        var doGetAuthCode = null;

        var request = require('request');

        var options = {
            url: config.smartHomeProviderCloudEndpoint+'/login',
            method: 'POST',
            followRedirect: false,
            body: post_data,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(post_data)
            }
        }

        // Start the request
        request(options, function (error, response, body) {
            if (!error) {
                Object.keys(response.headers).forEach(
                    function(name) {
                        let value = response.headers[name].toString();
                        console.log('[autoLogin login HEADERS]: ' + name + " = " + value);
                        if (name.indexOf('cookie') >= 0) {
                            cookie = value.substring(0, value.indexOf(";"));
                        }
                    }
                );
                console.log('[autoLogin login BODY]: ' +body);
                let rr = new RegExp(postobj.redirect_uri + '\\?([^ ]+)');
                let mm = rr.exec(body);
                if (mm) {
                    const parsed = querystring.parse(mm[1]);
                    if (parsed && parsed['code']) {
                        authCode = parsed.code;
                        console.log('[autoLogin LOGIN]: authcode ' + authCode);
                    }
                }
                doGetAuthCode();
            }
        });

        doGetAuthCode = function() {
            // Configure the request
            options = {
                url: config.smartHomeProviderCloudEndpoint+'/getauthcode',
                method: 'GET',
                headers: {
                    "Cookie": cookie
                },
                qs: {'code': authCode}
            }

            // Start the request
            request(options, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    Object.keys(response.headers).forEach(
                        function(name) {
                            let value = response.headers[name].toString();
                            console.log('[autoLogin getauthcode HEADERS]: ' + name + " = " + value);
                        }
                    );
                    console.log('[autoLogin getauthcode BODY]: ' +body);
                    if (body.startsWith('var'))
                        eval(body);
                    options.method = 'POST';
                    options.headers = {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + AUTH_TOKEN
                    };
                    options.url = config.smartHomeProviderCloudEndpoint+'/smart-home-api/auth';
                    delete options['qs'];
                    request(options, function (error, response, body) {
                        if (!error && response.statusCode == 200) {
                            Object.keys(response.headers).forEach(
                                function(name) {
                                    let value = response.headers[name].toString();
                                    console.log('[autoLogin auth HEADERS]: ' + name + " = " + value);
                                }
                            );
                            console.log('[autoLogin ahth BODY]: ' +body);
                        }
                    });
                }
            });
        }

        // post the data
        //http_req.write(post_data);
        //http_req.end();
    }

    app.addDevice = function(uid, device) {
        //app.smartHomeExec(uid, device);
        //var lnk = config.smartHomeProviderCloudEndpoint+'/smart-home-api/device-connection/'+device.id;
        //makeReq(lnk);
        return datastore.Auth.loadUserTokens(uid,config.smartHomeProviderGoogleClientId,["access"]).then(function(token) {
            if (token['access']) {
                var EventSource = require('eventsource');
                var es = new EventSource("http://localhost:"+config.devPortSmartHome + '/smart-home-api/device-connection/' + device.id);
                const options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token['access'].s
                    }
                };
                options.body = JSON.stringify(device);
                fetch("http://localhost:"+config.devPortSmartHome + '/smart-home-api/register-device/', options);
                return es;
            }
            else
                return null;
        },function(e) {
            if (e.stack)
                console.log(e.stack);
            else
                console.log("[addDevice error] Error detected: "+e);
            return null;
        });
    }

    app.removeDevice = function(uid, device) {
        //app.smartHomeExec(uid, device);
        //var lnk = config.smartHomeProviderCloudEndpoint+'/smart-home-api/device-connection/'+device.id;
        //makeReq(lnk);
        return datastore.Auth.loadUserTokens(uid,config.smartHomeProviderGoogleClientId,["access"]).then(function(token) {
            if (token['access']) {
                const options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token['access'].s
                    }
                };
                options.body = JSON.stringify(device);
                //console.log("[RemDevice] Removing device "+device.id);
                fetch("http://localhost:"+config.devPortSmartHome + '/smart-home-api/remove-device/', options);
            }
        },function(e) {
            if (e.stack)
                console.log(e.stack);
            else
                console.log("[removeDevice error] Error detected: "+e);
        });
    }

    app.modDevice = function(uid, device) {
        return datastore.Auth.loadUserTokens(uid,config.smartHomeProviderGoogleClientId,["access"]).then(function(token) {
            if (token['access']) {
                const options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token['access'].s
                    }
                };
                options.body = JSON.stringify(device);
                fetch("http://localhost:"+config.devPortSmartHome + '/smart-home-api/exec', options);
            }
        },function(e) {
            if (e.stack)
                console.log(e.stack);
            else
                console.log("[modDevice error] Error detected: "+e);
        });
    }

    var lastRequestSync = 0;

    app.requestSync = function(uid) {
        // REQUEST_SYNC
        var ts = Date.now();
        if (lastRequestSync && ts - lastRequestSync < 20000)
            return;
        //lastRequestSync = ts;
        const apiKey = config.smartHomeProviderApiKey;
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };
        optBody = {
            'agentUserId': uid
        };
        options.body = JSON.stringify(optBody);
        console.info("POST REQUEST_SYNC", requestSyncEndpoint + apiKey);
        console.info(`POST payload: ${JSON.stringify(options)}`);
        fetch(requestSyncEndpoint + apiKey, options).
        then(function(res) {
            console.log("request-sync response", res.status, res.statusText);
        });
    };

    let appPort = process.env.PORT || config.devPortSmartHome;
    if (typeof appPort=="string")
        appPort = parseInt(appPort);
    orv.configureModule(
        app.addDevice,
        app.modDevice,
        app.removeDevice,
        config.getInside("AUTOLOGIN")=="YES"?app.autoLogin:null).catch(function(err) {
            console.log("[ConfigureModule err] Error "+err);
            console.log(err.stack);
        });
    let starttype = config.getInside("START_TYPE");
    if (starttype=="GREENLOCK" || starttype=="GREENLOCKLOCAL") {
        const PROD = true;
        require('greenlock-express').create({

            server: PROD ? 'https://acme-v01.api.letsencrypt.org/directory' : 'staging'

                ,
            email: 'fulminedipegasus@gmail.com'

                ,
            agreeTos: true

                ,
            approveDomains: ['mfzhome.ddns.net']

                ,
            app: app.use('/', express.static('./frontend'))

        }).listen(appPort+1, 443);
    }
    if (starttype!="GREENLOCK") {
        const server = app.listen(appPort, function() {
            const host = server.address().address;
            const port = server.address().port;

            console.log('Smart Home Cloud and App listening at %s:%s', host, port);

            if (config.getInside("START_TYPE")=="NGROK") {
                ngrok.connect(config.devPortSmartHome, function(err, url) {
                    if (err) {
                        console.log('ngrok err', err);
                        process.exit();
                    }

                    console.log("|###################################################|");
                    console.log("|                                                   |");
                    console.log("|        COPY & PASTE NGROK URL BELOW:              |");
                    console.log("|                                                   |");
                    console.log("|          " + url + "                |");
                    console.log("|                                                   |");
                    console.log("|###################################################|");

                    console.log("=====");
                    console.log("Visit the Actions on Google console at http://console.actions.google.com")
                    console.log("Replace the webhook URL in the Actions section with:");
                    console.log("    " + url + "/smarthome");

                    console.log("In the console, set the Authorization URL to:");
                    console.log("    " + url + "/oauth");

                    console.log("");
                    console.log("Then set the Token URL to:");
                    console.log("    " + url + "/token");
                    console.log("");

                    console.log("Finally press the 'TEST DRAFT' button");
                });
            }
        });
    }

    function registerGoogleHa(app) {
        google_ha.registerAgent(app);
    }

    function registerAuth(app) {
        authProvider.registerAuth(app);
    }

    registerGoogleHa(app);
    registerAuth(app);

    console.log("\n\nRegistered routes:");
    app._router.stack.forEach(function(r) {
        if (r.route && r.route.path) {
            console.log(r.route.path);
        }
    })
}

config.init().then(function() {
    datastore.Auth.loadClient(config.smartHomeProviderGoogleClientId,config.smartHomeProvideGoogleClientSecret);
    cloudInit();
}).catch(function (err) {
    console.log("[Error] Error "+err+" in the init phase. Please check paramethers.")
});
