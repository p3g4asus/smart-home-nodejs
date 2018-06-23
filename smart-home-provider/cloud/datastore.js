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

/* eslint require-jsdoc: "off" */
/* eslint valid-jsdoc: "off" */

/**
 * Structure of Data
 * {
 *   <uid>: {
 *     <device id>: {
 *       properties: {
 *         <property name>: <property value>,
 *         <property name>: <property value>
 *       },
 *       states: {
 *         <state name>: <state value>,
 *         <state name>: <state value>
 *       }
 *     },
 *     <device id>: {...}
 *   },
 *   <uid>: {
 *     <device id>: {...},
 *     <device id>: {...},
 *     <device id>: {...}
 *   },
 *   ...
 * }
 */
const config = require('./config-provider');
const User = require('./users');
const Data = {};

/**
 * Structure of Auth
 * {
 *   clients: {
 *      <client id>:
 *          clientSecret: <value>,
 *          uid: <value>
 *      }
 *   },
 *   tokens: {
 *      <token id>: {
 *          <uid>: {}
 *      },
 *   },
 *   users: {
 *      <uid>: {
 *          name: <username>,
 *          password: <password>,
 *          tokens: [<token id>, ...],
 *          clients: [<client id>, ...]
 *      }
 *   }
 * }
 * @type {{}}
 */

/*
 * This is a set of hardcoded Auth clients and users (and their access tokens)
 * for testing this mock OAuth server. These fake users can be used just to
 * test the service. This is not real user data.
 */
const Auth = {
    clients: {
        /*'RKkWfsi0Z9': {
            clientId: 'RKkWfsi0Z9',
            clientSecret: 'eToBzeBT7OwrPQO8mZHsZtLp1qhQbe'
        },
        'ZxjqWpsYj3': {
            clientId: 'ZxjqWpsYj3',
            clientSecret: 'hIMH3uWlMVrqa7FAbKLBoNUMCyLCtv'
        }*/
    },
    clientsuser: {},
    tokens: {
        /*'psokmCxKjfhk7qHLeYd1': {
            uid: '1234',
            accessToken: 'psokmCxKjfhk7qHLeYd1',
            refreshToken: 'psokmCxKjfhk7qHLeYd1',
            userId: '1234'
        },
        'bfrrLnxxWdULSh3Y9IU2cA5pw8s4ub': {
            uid: '2345',
            accessToken: 'bfrrLnxxWdULSh3Y9IU2cA5pw8s4ub',
            refreshToken: 'bfrrLnxxWdULSh3Y9IU2cA5pw8s4ub',
            userId: '2345'
        },
        'kmjWldncnpr2drPCIe8n5TWvNEqqz8': {
            uid: '3456',
            accessToken: 'kmjWldncnpr2drPCIe8n5TWvNEqqz8',
            refreshToken: 'kmjWldncnpr2drPCIe8n5TWvNEqqz8',
            userId: '3456'
        },
        'CyZEA3izOsFoTd9hH76atzStqrSYVY': {
            uid: '4567',
            accessToken: 'CyZEA3izOsFoTd9hH76atzStqrSYVY',
            refreshToken: 'CyZEA3izOsFoTd9hH76atzStqrSYVY',
            userId: '4567'
        },
        'JK0u11W5jFXOCZCqUzF9zf9pnNZcim': {
            uid: '5678',
            accessToken: 'JK0u11W5jFXOCZCqUzF9zf9pnNZcim',
            refreshToken: 'JK0u11W5jFXOCZCqUzF9zf9pnNZcim',
            userId: '5678'
        },
        '2E1KuI3rQsrj51JyWs66nAShZwMliL': {
            uid: '6789',
            accessToken: '2E1KuI3rQsrj51JyWs66nAShZwMliL',
            refreshToken: '2E1KuI3rQsrj51JyWs66nAShZwMliL',
            userId: '6789'
        },
        '0EFBxAWH9iBYySHFQm5xpji8LWdlxg': {
            uid: '7890',
            accessToken: '0EFBxAWH9iBYySHFQm5xpji8LWdlxg',
            refreshToken: '0EFBxAWH9iBYySHFQm5xpji8LWdlxg',
            userId: '7890'
        },
        '7TX3ExuETedX8WneDT48': {
            uid: '4321',
            accessToken: '7TX3ExuETedX8WneDT48',
            refreshToken: '7TX3ExuETedX8WneDT48',
            userId: '4321'
        }*/
    },
    users: {
        /*'1234': {
            uid: '1234',
            name: 'rick',
            password: 'oldman',
            tokens: ['psokmCxKjfhk7qHLeYd1']
        },
        '2345': {
            uid: '2345',
            name: 'summer',
            password: 'tr0y',
            tokens: ['bfrrLnxxWdULSh3Y9IU2cA5pw8s4ub']
        },
        '3456': {
            uid: '3456',
            name: 'beth',
            password: 'doctor',
            tokens: ['kmjWldncnpr2drPCIe8n5TWvNEqqz8']
        },
        '4567': {
            uid: '4567',
            name: 'jerry',
            password: 'b3th',
            tokens: ['CyZEA3izOsFoTd9hH76atzStqrSYVY']
        },
        '5678': {
            uid: '5678',
            name: 'birdperson',
            password: 'tammy',
            tokens: ['JK0u11W5jFXOCZCqUzF9zf9pnNZcim']
        },
        '6789': {
            uid: '6789',
            name: 'squanchy',
            password: 'squanchy',
            tokens: ['2E1KuI3rQsrj51JyWs66nAShZwMliL']
        },
        '7890': {
            uid: '7890',
            name: 'jessica',
            password: 'br4d',
            tokens: ['0EFBxAWH9iBYySHFQm5xpji8LWdlxg']
        },
        '4321': {
            uid: '4321',
            name: 'morty',
            password: 'j3ssica',
            tokens: ['7TX3ExuETedX8WneDT48']
        }*/
    },
    usernames: {
        /*'rick': '1234',
        'summer': '2345',
        'beth': '3456',
        'jerry': '4567',
        'birdperson': '5678',
        'squanchy': '6789',
        'jessica': '7890',
        'morty': '4321'*/
    },
    userobj: {},
    authcodes: {},

    genRandomString: function() {
        return Math.floor(Math.random() * 10000000000000000000000000000000000000000).toString(36);
    },

    genUid: function() {
        let uid = Math.floor(Math.random() * 1000).toString();
        while (authstore.users[uid]) {
            uid = genUid();
        }
        return uid;
    },

    genUser: function(username, password) {
        Auth._putUserInDB(new User({
            'uid':Auth.getUid(),
            'username':username,
            'password':password
        }));
    },

    generateAuthCode: function(uid, clientId) {
        if (clientId) {
            let authCode = Auth.genRandomString();
            Auth.authcodes[authCode] = {
                type: 'AUTH_CODE',
                uid: uid,
                clientId: clientId,
                expiresAt: new Date(Date.now() + (60 * 10000))
            };
            return authCode;
        }
        else
            return null;
    },

    _putUserInDB: function (val) {
        let us;
        console.log("Putting in DB "+JSON.stringify(val));
        if (!Data[val.uid])
            Data[val.uid] = {};
        Auth.users[val.uid] = (us = {
            uid: val.uid,
            name: val.username,
            tokens: val.tokens
        });
        Auth.usernames[val.username] = val.uid;
        Auth.putTokensInDB(val.tokens);
        Auth.userobj[val.uid] = val;
        return us;
    },

    getAccessTokenByUid: function(uid) {
        return Auth.userobj[uid].tokens['access'].s;
    },

    loadUserTokens: function(uid,types) {
        return new Promise(function(resolve,reject) {
            let user,clientId;
            if (!(user = Auth.userobj[uid]))
                reject(100);
            else if (!(clientId = Auth.clientsuser[user.clientname]))
                reject(200);
            else {
                user.loadTokens(clientId,types).then(function(toks) {
                    Auth.putTokensInDB(toks);
                    resolve(toks);
                }).catch(function(err) {
                    reject(err);
                })
            }
        });
    },

    putTokensInDB: function(toks) {
        if (toks)
            Object.keys(toks).forEach(function(t) {
                if (toks[t])
                    Auth.tokens[toks[t].s] = {
                        uid: toks[t].uid,
                        token: toks[t],
                        userId: toks[t].uid
                    }
            });
    },

    getAutologinUsers: function() {
        return User.loadAutoLoginUsers().then(function (users) {
            users.forEach(function(us) {
                Auth._putUserInDB(us);
            });
            return users;
        });
    },

    getUser: function(username, password, enc) {
        let myuser;
        return User.authenticate(username, password, enc).then(
            function(us)  {
                myuser = us;
                let clientId = Auth.clientsuser[us.clientname];
                if (clientId)
                    return us.loadTokens(clientId,['access','refresh']);
                else
                    return Promise.reject(1852);
            }).then(function(toks) {
                Auth._putUserInDB(myuser);
                return myuser;
            });
    },

    clientByUsername: function(username) {
        return Auth.clientsuser[username];
    },

    loadClient: function(client) {
        Auth.clients[client.stringid] = {
            clientId: client.stringid,
            clientSecret: client.secret,
            apikey: client.apikey,
            username: client.username,
            jwt: require('./jwt-key.'+client.username+'.json')
        };
        Auth.clientsuser[client.username] = client.stringid;
    },
    /**
     * checks if user and auth exist and match
     *
     * @param uid
     * @param authToken
     * @returns {boolean}
     */
    isUserRegistered: function(uid) {
        try {
            let val = (Data.getUid(uid)) && Auth[uid]!=null && Auth[uid]==Auth.userobj[uid].tokens['refresh'].s;
            //console.log("[isUserRegistered out] "+val);
            return val;
        }
        catch(e) {
            console.log("[isUserRegistered err] "+e.stack);
            return false;
        }
        /*let t0,tok;
        return uid!=null && (Data.getUid(uid)) &&
            authToken!=null && (t0 = Auth.tokens[authToken])!=null &&
            (tok = t0.token).type=="access" && !tok.isExpired();*/

        // FIXME - reenable below once a more stable auth has been put in place
        // if (!Data.getUid(uid) || !Auth[uid])
        //     return false;
        // return (authToken == Auth[uid]);
    }
};

Data.version = 0;

/**
 * get a full status for everything stored for a user
 *
 * @param uid
 * @returns
 * {
 *   uid: <uid>,
 *   devices: {
 *     <device id>: {
 *       properties: {
 *         <property name>: <property value>,
 *         <property name>: <property value>
 *       },
 *       states: {
 *         <state name>: <state value>,
 *         <state name>: <state value>
 *       }
 *     },
 *     <device id>: {...},
 *     ...
 *   }
 * }
 */
Data.getUid = function(uid) {
    // console.log('getUid', uid);
    return Data[uid];
};

/**
 * get current states for all devices stored for a user
 *
 * @param uid
 * @param deviceIds
 * @returns
 * {
 *   <device id>: {
 *     <state name>: <state value>,
 *     <state name>: <state value>
 *   },
 *   <device id>: {...},
 * }
 */
Data.getStates = function(uid, deviceIds = undefined) {
    // console.log('getStates', uid);
    let states = {};

    if (!deviceIds) {
        Object.keys(Data[uid]).forEach(function(deviceId) {
            if (Data[uid].hasOwnProperty(deviceId)) {
                states[deviceId] = Data[uid][deviceId].states;
            }
        });
    } else {
        for (let i = 0; i < deviceIds.length; i++) {
            let deviceId = deviceIds[i];
            if (Data[uid].hasOwnProperty(deviceId)) {
                states[deviceId] = Data[uid][deviceId].states;
            }
        }
    }

    return states;

};

/**
 * get current states for all devices stored for a user
 *
 * @param uid
 * @param deviceIds
 * @returns
 * {
 *   <device id>: {
 *     <property name>: <property value>,
 *     <property name>: <property value>
 *   },
 *   <device id>: {...},
 * }
 */
Data.getProperties = function(uid, deviceIds = undefined) {
    // console.log('getProperties', uid);
    let properties = {};

    if (!deviceIds) {

        if (!Data.hasOwnProperty(uid)) {
            return properties;
        }
        Object.keys(Data[uid]).forEach(function(deviceId) {
            if (Data[uid].hasOwnProperty(deviceId)) {
                properties[deviceId] = Data[uid][deviceId].properties;
            }
        });
    } else {
        for (let i = 0; i < deviceIds.length; i++) {
            let deviceId = deviceIds[i];
            if (Data[uid].hasOwnProperty(deviceId)) {
                properties[deviceId] = Data[uid][deviceId].properties;
            }
        }
    }

    return properties;
};

/**
 * get a status for the passed in device ids, otherwise get a full status
 *
 * @param uid
 * @param deviceIds (optional)
 * @returns
 * {
 *   uid: <uid>,
 *   devices: {
 *     <device id>: {
 *       properties: {
 *         <property name>: <property value>,
 *         <property name>: <property value>
 *       },
 *       states: {
 *         <state name>: <state value>,
 *         <state name>: <state value>
 *       }
 *     },
 *     <device id>: {...},
 *     ...
 *   }
 * }
 */
Data.getStatus = function(uid, deviceIds = undefined) {
    // return Data.getUid(uid);
    if (!Data[uid]) {
        console.error("cannot getStatus of devices without first registering the user!");
        return;
    }

    // console.log('getStatus deviceIds', deviceIds);
    if (!deviceIds || deviceIds == {} ||
        (Object.keys(deviceIds).length === 0 && deviceIds.constructor === Object))
        return Data.getUid(uid);

    let devices = {};
    for (let i = 0; i < deviceIds.length; i++) {
        let curId = deviceIds[i];
        if (!Data[uid][curId])
            continue;
        devices[curId] = Data[uid][curId];
        // console.log('devices[curId]', devices[curId]);
    }
    // console.log('devices', devices);
    return devices;
};

/**
 * register or update a user's data
 *
 * @param uid
 * @param authToken
 */
Data.registerUser = function(uid, authToken) {
    if (!authToken) {
        console.error("cannot register a user without an authToken!");
        return;
    }
    if (!Data[uid])
        Data[uid] = {};
    Auth[uid] = authToken;
    Data.version++;
};

/**
 * removes a user from authstore
 *
 * @param uid
 * @param authToken
 */
Data.removeUser = function(uid, authToken) {
    if (!authToken) {
        console.error("cannot remove a user without an authToken!");
        return;
    }
    if (!Auth.isUserRegistered(uid)) {
        console.error("cannot remove a user with mis-matched authToken!");
        return;
    }
    delete Data[uid];
    delete Auth[uid];
    Data.version++;
};

/**
 * update a device
 *
 * @param uid
 * @param device
 * {
 *   states: {
 *     on: true,
 *     online: true
 *      ...
 *   },
 *   properties: {
 *     name: "smart home light 1",
 *     firmware: "1fzxa84232n4nb6478n8",
 *     traits: ["onoff"],
 *     nickname: "kitchen light",
 *     type: "light",
 *      ...
 *   }
 * }
 */
Data.execDevice = function(uid, device) {
    if (!Data[uid]) {
        console.error("cannot register a device without first registering the user!");
        return;
    }
    // console.log('execDevice', device);
    if (!Data[uid][device.id])
        Data[uid][device.id] = {
            states: {},
            properties: {},
            executionStates: [],
            reportStates: [],
        };
    if (device.hasOwnProperty('properties')) {
        // update properties
        Object.keys(device.properties).forEach(function(key) {
            if (device.properties.hasOwnProperty(key)) {
                // console.log('property ' + key, device.properties[key]);
                Data[uid][device.id].properties[key] = device.properties[key];
            }
        });
    }
    if (device.hasOwnProperty('states')) {
        // update states
        Object.keys(device.states).forEach(function(key) {
            if (device.states.hasOwnProperty(key)) {
                // console.log('state ' + key, device.states[key]);
                Data[uid][device.id].states[key] = device.states[key];
            }
        });
    }
    if (device.hasOwnProperty('executionStates')) {
        // update array of states
        Data[uid][device.id].executionStates = device.executionStates;
    }
    if (device.hasOwnProperty('reportStates')) {
        // update array of states
        Data[uid][device.id].reportStates = device.reportStates;
    }
    // console.log('execDevice after', Data[uid][device.id]);
    Data.version++;
};

/**
 * register or update a device
 *
 * @param uid
 * @param device
 */
Data.registerDevice = function(uid, device) {
    // wrapper for exec, since they do the same thing
    Data.execDevice(uid, device);
};

/**
 * resets user account, deleting all devices on page refresh
 */
Data.resetDevices = function(uid) {
    // Deletes all devices for the user.
    if (!Data[uid]) {
        console.error("cannot remove a device without first registering the user!");
        return;
    }
    console.info("Deleting all devices for " + uid);
    Data[uid] = {};
    Data.version = 0;
}

/**
 * removes a device from authstore
 *
 * @param uid
 * @param device
 */
Data.removeDevice = function(uid, device) {
    if (!Data[uid]) {
        console.error("cannot remove a device without first registering the user!");
        return;
    }
    console.info("Deleting device " + device.id + " for " + uid);
    delete Data[uid][device.id];
    Data.version++;
};

exports.getUid = Data.getUid;
exports.getStatus = Data.getStatus;
exports.getStates = Data.getStates;
exports.getProperties = Data.getProperties;
exports.registerUser = Data.registerUser;
exports.removeUser = Data.removeUser;
exports.execDevice = Data.execDevice;
exports.registerDevice = Data.registerDevice;
exports.resetDevices = Data.resetDevices;
exports.removeDevice = Data.removeDevice;
exports.Auth = Auth;
