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
/**
 * This auth is going to use the Authorization Code flow, described in the docs:
 * https://developers.google.com/actions/develop/identity/oauth2-code-flow
 */
const Auth = {};
const express = require('express');
const authstore = require('./datastore').Auth;
const util = require('util');
const session = require('express-session');
const User = require('./users');

Auth.getAccessToken = function(request) {
    return request.headers.authorization ? request.headers.authorization.split(' ')[1] : null;
};
Auth.getUid = function(request) {
    return request.headers.uid;
};
Auth.checkAuth = function(request,response,redir,checkRegistration) {
    if (typeof redir=="undefined" || ! redir || !redir.length)
        redir = '/frontend';
    let authToken,uid,tok;
    let error = 0;
    if (!(authToken = Auth.getAccessToken(request)))
        error = 1;
    else if (!(tok = authstore.tokens[authToken]))
        error = 2;
    else if (!(tok = tok.token))
        error = 7;
    else if (tok.type!="access")
        error = 5;
    else if (tok.isExpired())
        error = 6;
    else if (!(uid = tok.uid))
        error = 3;
    else if (checkRegistration && !authstore.isUserRegistered(uid))
        error = 4;
    if (error) {
        console.log('[CheckAuth] Auth error '+error+" at = "+authToken);
        let path = require('util').format('/login?redirect_uri=%s&state=%s',
                encodeURIComponent(redir), 'cool_jazz');
        response.status(400).set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }).json({
            'error': "invalid_grant",
            'reason':"Cannot validate token: error is "+error,
            'redir': redir
        });
        return null;
    }
    else
        return uid;
};

const SmartHomeModel = {};

SmartHomeModel.getAccessToken = function(code) {
    return new Promise(function(resolve,reject) {
        let authCode = authstore.authcodes[code],user;
        if (!authCode)
            reject('invalid code');
        if (new Date(authCode.expiresAt) < Date.now())
            reject('expired code');
        else if (!authstore.userobj[authCode.uid] || authCode.clientId!=authstore.clientsuser[authstore.userobj[authCode.uid].clientname])
            reject('uid and client_id do not match');
        else {
            authstore.loadUserTokens(authCode.uid,["access","refresh"]).then(function(tokens){
                let acctok,refrtok;
                if (!(acctok = tokens.access) || !(refrtok = tokens.refresh))
                    reject("Error generating tokens: "+JSON.stringify(tokens));
                else {
                    let returnToken = {
                        token_type: "bearer",
                        access_token: acctok.s,
                        refresh_token: refrtok.s,
                        expires_in: Math.floor((acctok.expire-Date.now())/1000)
                    };
                    console.log('return getAccessToken = ', returnToken);
                    resolve(returnToken);
                }
            }).catch(function (err) {
                reject("Cannot generate new access token: error "+err);
            });
        }
    });
};

SmartHomeModel.getCredentials = function(req) {
    let client_id = req.query.client_id ? req.query.client_id : req.body.client_id;
    let client_secret = req.query.client_secret ? req.query.client_secret : req.body.client_secret;

    if (!client_id || !client_secret) {
        let hd;
        if ((hd = req.headers.authorization) && hd.indexOf("Basic ")==0 &&
            (hd = /([^:]+):([^:]+)/.exec(Buffer.from(hd.substr(6), 'base64').toString('ascii')))) {
            client_id = hd[1];
            client_secret = hd[2];
        }
        else {
            console.error('missing required parameter');
            return null;
        }
    }
    let client = SmartHomeModel.getClient(client_id, client_secret);
    console.log('client', client);
    return client;
};

SmartHomeModel.getClient = function(clientId, clientSecret) {
    console.log('getClient %s, %s', clientId, clientSecret);
    let client = authstore.clients[clientId];
    if (!client || (client.clientSecret != clientSecret)) {
        console.log('clientSecret doesn\'t match %s, %s', client.clientSecret, clientSecret);
        return false;
    }

    console.log('return getClient', client);
    return client;
};

/*SmartHomeModel.getUser = function(username, password) {
    console.log('getUser', username);
    return authstore.getUser(username, password);
    let userObj = authstore.getUser(username,password);
  if (!userObj) {
    //console.log('not a user', username);
    //SmartHomeModel.genUser(username, password);
    //userId = authstore.usernames[username];
    //if (!userId) {
    //  console.log('failed to genUser', userId);
    //  return false;
  //}
    return false;
}
  let userId = authstore.usernames[username];
  let user = authstore.users[userId];
  if (!user) {
    console.log('not a user', user);
    return false;
}
  //if (user.password != password) {
    //console.log('passwords do not match!', user);
    //return false;
//}

  return user;
};*/

Auth.registerAuth = function(app) {
    /**
     * expecting something like the following:
     *
     * GET https://myservice.example.com/auth? \
     *   client_id=GOOGLE_CLIENT_ID - The Google client ID you registered with Google.
     *   &redirect_uri=REDIRECT_URI - The URL to which to send the response to this request
     *   &state=STATE_STRING - A bookkeeping value that is passed back to Google unchanged in the result
     *   &response_type=code - The string code
     */
    app.get('/oauth', function(req, res) {
        let client_id = req.query.client_id;
        let redirect_uri = req.query.redirect_uri;
        let state = req.query.state;
        let response_type = req.query.response_type;
        let authCode = req.query.code;
        console.log('[OAUTH] Query ', JSON.stringify(req.query));
        if ('code' != response_type)
            return res.status(500).send('response_type ' + response_type + ' must equal "code"');

        if (!authstore.clients[client_id])
            return res.status(500).send('client_id ' + client_id + ' invalid');

        // if you have an authcode use that
        if (authCode) {
            return res.redirect(util.format('%s?code=%s&state=%s',
                redirect_uri, authCode, state
            ));
        }

        let user = req.session.user;
        // Redirect anonymous users to login page.
        if (!user || authstore.clientsuser[user.clientname]!=client_id) {
            return res.redirect(util.format('/login?redirect_uri=%s&redirect=%s&state=%s',
                encodeURIComponent(redirect_uri), req.path, state));
        }

        console.log('[OAUTH] login successful ', user.username);
        authCode = authstore.generateAuthCode(user.uid, client_id);

        if (authCode) {
            console.log('[OAUTH] authCode successful ', authCode);
            return res.redirect(util.format('%s?code=%s&state=%s',
                redirect_uri, authCode, state));
        }

        return res.status(400).send('something went wrong');

    });

    app.use('/login', express.static('./frontend/login.html'));
    app.use('/signup', express.static('./frontend/signup.html'));
    app.use('/options', express.static('./frontend/options.html'));

    // Post login.
    app.post('/signup', function(req, res) {
        console.log('/signup ', req.body);
        let config = require('./config-provider');
        let us = new User({
            "username": req.body.username,
            "password": req.body.password,
            "clientname": req.body.clientname,
        });
        let dec = function(a, b) {
            return a && a.length ? a : b;
        };
        us.save().then(function(user) {
            return res.redirect(util.format('%s?redirect_uri=%s&state=%s&response_type=code',
                '/login', encodeURIComponent('/options'), req.body.state));
        }).catch(function(err) {
            console.log(err + ' not a user', req.body.username);
            return res.redirect(util.format('%s?redirect_uri=%s&state=%s&response_type=code&username=%s&password=%s',
                '/signup',
                encodeURIComponent(dec(req.body.redirect_uri, '/login')),
                req.body.state, req.body.username, req.body.password));
        });
    });

    // Post login.
    app.post('/login', function(req, res) {
        console.log('/login ', req.body);
        let pw;
        let enc;
        if (req.body.password2 && req.body.password2.length) {
            pw = req.body.password2;
            enc = true;
        }
        else {
            pw = req.body.password;
            enc = false;
        }
        if (!pw || !req.body.username) {
            let dec = function(a, b) {
                return a && a.length && a!="undefined"? a : b;
            };
            let config = require('./config-provider');
            res.redirect(util.format('%s?redirect_uri=%s&state=%s&response_type=code',
                '/login',
                encodeURIComponent('/frontend'), dec(req.body.state,"redir_ok")));
        }
        else {
            authstore.getUser(req.body.username, pw, enc).then(
                function(user) {
                    console.log('logging in ', user);
                    req.session.user = user;
                    // Successful logins should send the user back to /oauth/.
                    //console.log("redir "+req.body.redirect);
                    //console.log("ook "+authstore.userobj[user.uid].optionsOk());
                    let path;
                    if (req.body.redirect && req.body.redirect.length)
                        path = req.body.redirect;
                    else if (req.params.redirect && req.params.redirect.length)
                        path = req.params.redirect;
                    else if (authstore.userobj[user.uid].optionsOk())
                        path = '/frontend';
                    else
                        path = '/options';
                    path = decodeURIComponent(path);

                    console.log('login successful ', user.username);
                    let authCode = authstore.generateAuthCode(user.uid, authstore.clientsuser[user.clientname]);

                    if (authCode) {
                        console.log('authCode successful ', authCode);
                        return res.redirect(util.format('%s?code=%s&state=%s',
                            path, authCode, req.body.state));
                    } else {
                        console.log('authCode failed');
                        return res.redirect(util.format('%s?redirect_uri=%s&state=%s&response_type=code',
                            path, encodeURIComponent(req.body.redirect_uri), req.body.state));
                    }
                }
            ).catch(function(err) {
                console.log('[Login] Error '+err + ' not a user', req.body.username);
                return res.redirect(util.format('%s?redirect_uri=%s&state=%s&response_type=code',
                    '/frontend', encodeURIComponent(req.body.redirect_uri), req.body.state));
            });
        }
    });

    /**
     * client_id=GOOGLE_CLIENT_ID
     * &client_secret=GOOGLE_CLIENT_SECRET
     * &response_type=token
     * &grant_type=authorization_code
     * &code=AUTHORIZATION_CODE
     *
     * OR
     *
     *
     * client_id=GOOGLE_CLIENT_ID
     * &client_secret=GOOGLE_CLIENT_SECRET
     * &response_type=token
     * &grant_type=refresh_token
     * &refresh_token=REFRESH_TOKEN
     */
    app.all('/token', function(req, res) {
        console.log('/token query', req.query);
        console.log('/token body', req.body);
        let grant_type = req.query.grant_type ? req.query.grant_type : req.body.grant_type;

        let client = SmartHomeModel.getCredentials(req);

        if (!client) {
            console.error('incorrect client data');
            return res.status(400).send('incorrect client data');
        }

        if ('authorization_code' == grant_type) {
            handleAuthCode(req).then(function(tok) {
                return res.status(200).send(tok);
            }).catch(function(reason) {
                return res.status(400).send({"error": "invalid_grant","reason":reason});
            });
        }
        else if ('refresh_token' == grant_type) {
            handleRefreshToken(req).then(function(tok) {
                return res.status(200).send(tok);
            }).catch(function(reason) {
                console.log("[Token] err reason "+reason);
                return res.status(400).send({"error": "invalid_grant","reason":reason});
            });
        }
        else {
            console.error('grant_type ' + grant_type + ' is not supported');
            return res.status(400).send(
                {"error": "invalid_grant",
                "reason":'grant_type ' + grant_type + ' is not supported'});
        }
    });
};


// code=wk41krp1kz4s8cs00s04s8o4s
// &redirect_uri=https%3A%2F%2Fdevelopers.google.com%2Foauthplayground
// &client_id=RKkWfsi0Z9
// &client_secret=eToBzeBT7OwrPQO8mZHsZtLp1qhQbe
// &scope=
// &grant_type=authorization_code


/**
 * @return {{}}
 * {
 *   token_type: "bearer",
 *   access_token: "ACCESS_TOKEN",
 *   refresh_token: "REFRESH_TOKEN"
 * }
 */
function handleAuthCode(req) {
    return new Promise(function(resolve,reject) {
        console.log('handleAuthCode', req.query);
        let code = req.query.code ? req.query.code : req.body.code;

        let client = SmartHomeModel.getCredentials(req);
        let authCode;

        if (!code) {
            console.error('missing required parameter');
            reject('missing required parameter');
        }
        else if (!client) {
            console.error('invalid client data');
            reject('invalid client id or secret');
        }
        else if (!(authCode = authstore.authcodes[code])) {
            console.error('invalid code');
            reject('invalid code');
        }
        else if (new Date(authCode.expiresAt) < Date.now()) {
            console.error('expired code');
            reject('expired code');
        }
        else if (authCode.clientId != client_id) {
            console.error('invalid code - wrong client', authCode);
            reject('invalid code - wrong client');
        }
        else {
            SmartHomeModel.getAccessToken(code).then(function(token) {
                console.log('respond success', token);
                resolve(token);
            }).catch(function(reason) {
                console.error('unable to generate a token', reason);
                reject(reason);
            });
        }
    });
}

/**
 * @return {{}}
 * {
 *   token_type: "bearer",
 *   access_token: "ACCESS_TOKEN",
 * }
 */
function handleRefreshToken(req) {
    return new Promise(function(resolve,reject) {
        let refresh_token = req.query.refresh_token ? req.query.refresh_token : req.body.refresh_token;

        let client = SmartHomeModel.getCredentials(req),tok,uid;
        if (!client)
            reject('invalid client id or secret');
        else if (!refresh_token)
            reject('missing required parameter');
        else if (!(tok = authstore.tokens[refresh_token]))
            reject('token not present in DB');
        else if (!(tok = tok.token))
            reject('token is not a valid token object');
        else if (tok.client!=client.clientId)
            reject('token is not for clientid '+client.clientId+' but for '+tok.client);
        else if (tok.type!="refresh")
            reject('token is not a refresh token');
        else if (tok.isExpired())
            reject('token is expired');
        else if (!(uid = tok.uid))
            reject('invalid user associated to the token');
        else if (!authstore.userobj[uid] || client.clientId!=authstore.clientsuser[authstore.userobj[uid].clientname])
            reject('user cannot be used with this client');
        else {
            authstore.loadUserTokens(uid,['access']).then(function(toks) {
                let acctok;
                if ((acctok = toks.access))
                    resolve({
                        token_type: "bearer",
                        access_token: acctok.s,
                        expires_in: Math.floor((acctok.expire-Date.now())/1000)
                    });
                else
                    reject('Cannot generate access token from refresh token');
            }).catch(function(err) {
                reject("Error generating access token from refresh token: "+err);
            });
        }

    });
}

/*function login(req, res) {
    return res.render('login', {
        redirect: encodeURIComponent(req.query.redirect),
        client_id: req.query.client_id,
        state: req.query.state,
        redirect_uri: encodeURIComponent(req.query.redirect_uri)
    });
}*/

exports.registerAuth = Auth.registerAuth;
exports.getAccessToken = Auth.getAccessToken;
exports.getUid = Auth.getUid;
exports.checkAuth = Auth.checkAuth;
