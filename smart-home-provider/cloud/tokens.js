const bcrypt = require('bcryptjs');
const redis_client = require('./redisconf');
const hat = require('hat');

var Token = (function(){
    var Token = function (us) {
        var that = this;
        that.type = us.hasOwnProperty('type')?us.type:"access";
        that.expire = us.hasOwnProperty('expire')?us.expire:0;
        that.client = us.hasOwnProperty('client')?us.client:null;
        that.uid = us.hasOwnProperty('uid')?us.uid:null;
        that.s = us.hasOwnProperty('s')?us.s:null;
        if (typeof that.expire=='string') {
            that.expire = parseInt(that.expire);
            that.expire = isNaN(that.expire)?0:that.expire;
        }

        that.isExpired = function() {
            return that.expire>=0 && Date.now()>that.expire;
        }

        that.remove = function() {
            let resolve,reject;
            let prom = new Promise(function(res,rej) {
                resolve = res;
                reject = rej;
            });
            Token._removeFromSet(that.s).then(function() {
                redis_client.del("token:"+that.s,function(err0,res0) {
                    if ((err0 || !res0) && err0)
                        reject(400);
                    else {
                        redis_client.srem("token:uid:"+that.uid,that.s,function(err0,resDel) {
                            if (err0 || !resDel)
                                reject(500);
                            else
                                resolve(that);
                        });
                    }
                });
            });
            return prom;
        }

        that.toString = function() {
            return JSON.stringify(that);
        }

        that.save = function() {
            let resolve,reject;
            let prom = new Promise(function(res,rej) {
                resolve = res;
                reject = rej;
            });
            let saddUid = function() {
                redis_client.sadd("token:uid:"+that.uid,that.s,function(err3,res3) {
                    if (err3 || !res3)
                        reject(700);
                    else
                        resolve(that);
                });
            }
            let trysave = function(s) {
                Token._addToSet(s).then(function() {
                    that.s = s;
                    if (!that.expire)
                        that.expire = Date.now()+Token.ACCESS_EXPIRE;
                    redis_client.hmset("token:"+s,
                        "expire", that.expire,
                        "client", that.client,
                        "uid", that.uid,
                        "type", that.type,
                        "s", s, function (err3,resHMSet3) {
                            if (err3 || resHMSet3.indexOf("OK")<0)
                                reject(200);
                            else
                                saddUid();
                        });
                })
                .catch(function() {
                    if (that.s)
                        reject(400);
                    else
                        trysave(Token.rack());
                });
            }
            trysave(!that.s?Token.rack():that.s);
            return prom;
        }
    }
    Token.rack = hat.rack();
    Token._addToSet = function(s) {
        return new Promise(function(resolve1,reject1) {
            redis_client.sadd("token:validtokens",s,function(err3,res3) {
                if (err3 || !res3)
                    reject1();
                else
                    resolve1();
            });
        });
    }
    Token._removeFromSet = function(s) {
        return new Promise(function(resolve1,reject1) {
            redis_client.srem("token:validtokens",s,function(err3,res3) {
                if (err3 || !res3)
                    console.log('[Token._reomeveFromSet] err3 = '+err3+' res3 = '+res3);
                resolve1();
            });
        });
    }
    Token.loadByS = function(s) {
        let resolve,reject;
        let prom = new Promise(function(res,rej) {
            resolve = res;
            reject = rej;
        });
        redis_client.hgetall("token:"+s,function(err1,res1) {
            if (err1 || !res1)
                reject(1200);
            else {
                let t = new Token(res1);
                if (!t.isExpired()) {
                    console.log("[Token] OK: "+t);
                    resolve(t);
                }
                else {
                    t.remove().then(function(us) {
                        console.log("[Token] Expired, removed OK: "+t);
                        reject(1400);
                    }).catch(function(err) {
                        console.log("[Token] Expired, removed Error: "+t+"; "+err);
                        reject(1450);
                    });
                }
            }
        });
        return prom;
    }
    Token.ACCESS_EXPIRE = 3600000;
    Token.loadByUid = function(uid,client,types) {
        let resolve,reject;
        let prom = new Promise(function(res,rej) {
            resolve = res;
            reject = rej;
        });
        let outobj = {};

        let loadToken = function(res3,idx) {
            if (res3.length<=idx)
                resolve(outobj);
            else {
                Token.loadByS(res3[idx]).then(function(t) {
                    let iType = types.indexOf(t.type);
                    if (iType>=0 && client==t.client) {
                        outobj[t.type] = t;
                        types.splice(iType,1);
                        if (types.length)
                            loadToken(res3,idx+1);
                        else
                            resolve(outobj);
                    }
                    else
                        loadToken(res3,idx+1);
                }).catch(function(err) {
                    loadToken(res3,idx+1);
                });
            }
        }
        redis_client.smembers("token:uid:"+uid,function(err3,res3) {
            if (err3 || !res3)
                resolve(outobj);
            else
                loadToken(res3,0);
        });
        return prom;
    }
    return Token;
})();
module.exports = Token;
