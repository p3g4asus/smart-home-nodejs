const bcrypt = require('bcryptjs');
const redis_client = require('./redisconf');
const Token = require('./tokens');

var User = (function(){
    var User = function (us) {
        var that = this;
        that.options = {
            filters: [],
            language: "it",
            defaultremote:"",
            orvhost: "localhost",
            orvport: 10001,
            orvretry: 0,
            autologin: true
        }
        if (us["options"]) {
            if (us.options.hasOwnProperty('filters'))
                that.options.filters = us.options.filters;
            if (us.options.hasOwnProperty('language'))
                that.options.language = us.options.language;
            if (us.options.hasOwnProperty('defaultremote'))
                that.options.defaultremote = us.options.defaultremote;
            if (us.options.hasOwnProperty('orvhost'))
                that.options.orvhost = us.options.orvhost;
            if (us.options.hasOwnProperty('orvport'))
                that.options.orvport = us.options.orvport;
            if (us.options.hasOwnProperty('orvretry'))
                that.options.orvretry = us.options.orvretry;
            if (us.options.hasOwnProperty('autologin'))
                that.options.autologin = us.options.autologin;
        }
        that.uid = us.hasOwnProperty('uid')?us.uid:null;
        that.clientname = us.hasOwnProperty('clientname')?us.clientname:null;
        that.username = us.hasOwnProperty('username')?us.username:null;
        that.password = us.hasOwnProperty('password')?us.password:null;
        that.tokens = us.hasOwnProperty('tokens')?us.tokens:{'access':null,'refresh':null};
        let padToSix = number => number <= 99999 ? ("00000"+number).slice(-6) : ""+number;
        that.optionsOk = function() {
            return that.options.defaultremote.length && that.options.filters.length;
        }
        that.saveOptions = function() {
            let manageAutoLogin = function(nextid) {
                return new Promise(function(resolve1,reject1) {
                    if (that.options.autologin)
                        redis_client.sadd("user:autologin",nextid,function(err3,res3) {
                            resolve1(that);
                        });
                    else {
                        redis_client.srem("user:autologin",nextid,function(err3,res3) {
                            resolve1(that);
                        });
                    }
                });
            }
            let hmSetOptions = function(nextid) {
                return new Promise(function(resolve1,reject1) {
                    redis_client.hmset("user:options:"+nextid,
                        "defaultremote", that.options.defaultremote,
                        "orvhost", that.options.orvhost,
                        "orvport", that.options.orvport,
                        "orvretry", that.options.orvretry,
                        "autologin", that.options.autologin,
                        "language", that.options.language, function (err3,resHMSet3) {
                            if (err3 || resHMSet3.indexOf("OK")<0)
                                reject1(err3?err3:9000);
                            else
                                resolve1(that);
                        });
                });
            };
            let delFilters = function(nextid) {
                return new Promise(function(resolve1,reject1) {
                    redis_client.del("user:filters:"+nextid,function(err0,resDel) {
                        resolve1(that);
                    });
                });
            }
            let setAddFilters = function(nextid,n) {
                if (that.options.filters.length==0)
                    return Promise.resolve(that);
                else {
                    return new Promise(function(resolve1,reject1) {
                        redis_client.sadd("user:filters:"+nextid,that.options.filters[n], function (err4,resSadd4) {
                            if (err4)
                                reject1(err4);
                            else
                                resolve1(that);
                        });
                    });
                }
            };
            let pstart = hmSetOptions(that.uid).then(function(us) {
                return manageAutoLogin(that.uid);
            });
            pstart = pstart.then(function(us) {
                return delFilters(that.uid);
            });
            for (let i  = 0; i<that.options.filters.length; i++) {
                pstart = pstart.then(function(us) {
                    return setAddFilters(that.uid,i);
                });
            }
            return pstart;

        };
        that.createToken = function(clientid,type,expire) {
            let resolve,reject;
            let prom = new Promise(function(res,rej) {
                resolve = res;
                reject = rej;
            });
            let dt = typeof expire!="undefined"?expire:(type=='refresh'?-1:0);
            let t = new Token({
                'uid':that.uid,
                'type':type,
                'client':clientid,
                'expire':dt
            });
            t.save().then(function(tok) {
                that.tokens[type] = tok;
                resolve(tok);
            }).catch(function(err) {
                reject(err);
            });
            return prom;
        }

        that.loadTokens = function(clientid,types) {
            let resolve,reject;
            let prom = new Promise(function(res,rej) {
                resolve = res;
                reject = rej;
            });
            let tokens = {};
            let outtypes = [];
            types.forEach(function(type) {
                if (!that.tokens[type] || that.tokens[type].isExpired())
                    outtypes.push(type);
                else
                    tokens[type] = that.tokens[type];
            });
            Token.loadByUid(that.uid,clientid,outtypes).then(function(outtok) {
                Object.assign(tokens,outtok);
                Object.assign(that.tokens,outtok);
                let newToken = function(idx) {
                    if (idx>=outtypes.length)
                        resolve(tokens);
                    else {
                        let type = outtypes[idx];
                        if (!tokens.hasOwnProperty(type)) {
                            console.log("[User Token] Token "+type+" does not exist or is expired: creating");
                            that.createToken(clientid,type).then(function(tok) {
                                tokens[type] = tok;
                                that.tokens[type] = tok;
                                console.log("[User Token] Token "+type+" created successfully: "+JSON.stringify(tok));
                                newToken(idx+1);
                            }).catch(function(err) {
                                newToken(idx+1);
                            })
                        }
                        else {
                            console.log("[User Token] Token "+type+" loaded successfully: "+JSON.stringify(tokens[type]));
                            newToken(idx+1);
                        }
                    }
                }
                newToken(0);
            });
            return prom;
        }

        that.save = function() {
            let setMaxId = function(nextid) {
                return new Promise(function(resolve1,reject1) {
                    redis_client.set("user:maxid",""+(nextid+1),function(err2,resSet2) {
                        if (err2 || resSet2.indexOf("OK")<0)
                            reject1(err2?err2:1000);
                        else
                            resolve1(that);
                    });
                });
            }
            let hmSetUser = function(nextid) {
                that.uid = that.uid==null?padToSix(nextid):that.uid;
                return new Promise(function(resolve1,reject1) {
                    redis_client.hmset("user:"+that.uid,
                        "password", User.hashPassword(that.password),
                        "username", that.username,
                        "clientname",that.clientname,
                        "uid", that.uid, function (err3,resHMSet3) {
                            if (err3 || resHMSet3.indexOf("OK")<0)
                                reject1(err3?err3:2000);
                            else
                                resolve1(that);
                        });
                });
            };
            let vSadd = function(nextid,setn,err) {
                return new Promise(function(resolve1,reject1) {
                    redis_client.sadd(setn,nextid, function (err4,resSadd4) {
                        if (err4 || resSadd4!=1)
                            reject1(err4?err4:err);
                        else
                            resolve1(that);
                    });
                });
            }
            let vSet = function(nextid,setn,err) {
                return new Promise(function(resolve1,reject1) {
                    redis_client.set(setn,nextid, function (err4,resSadd4) {
                        if (err4 || resSadd4!="OK") {
                            console.log("e4 "+err4+" resA "+resSadd4);
                            reject1(err4?err4:err);
                        }
                        else
                            resolve1(that);
                    });
                });
            }
            return User.usernameTaken(that.username).then(function (taken) {
                if (taken)
                    throw 1500;
                else {
                    var nextid = -1;
                    return User.getMaxId().then(function(nid) {
                        nextid = nid;
                        return setMaxId(nextid);
                    }).then(function(us) {
                        return hmSetUser(nextid);
                    }).then(function(us) {
                        return vSadd(that.uid,"user:validusers",3000);
                    }).then(function(us) {
                        return vSet(that.uid,"user:username:"+that.username,6000);
                    }).then(function(us) {
                        return that.saveOptions();
                    });
                }
            });
        }
    };
    User.getMaxId = function() {
        return new Promise(function (resolve1,reject1) {
            redis_client.get("user:maxid", function (err1, maxid) {
                if (maxid==null)
                    maxid = '0';
                let nextid = parseInt(maxid);
                resolve1(nextid);
            });
        });
    };
    User.usernameTaken = function(us) {
        return new Promise(function (resolve1,reject1) {
            redis_client.get("user:username:"+us, function (err1, maxid) {
                resolve1(maxid!=null);
            });
        });
    };
    User.loadAutoLoginUsers = function() {
        let out = [];
        return new Promise(function (resolve1,reject1) {
            redis_client.smembers("user:autologin", function (err1, res1) {
                let manageResult = function(n) {
                    if (n+1<res1.length)
                        loadSingleUser(n+1);
                    else if (out.length)
                        resolve1(out);
                    else
                        reject1([]);
                }
                let loadSingleUser = function(n) {
                    User.findById(res1[n]).then(function (user) {
                        out.push(user);
                        manageResult(n);
                    }).catch(function (err) {
                        console.log("Error "+err+" in loading user "+res1[n]);
                        manageResult(n);
                    });
                }
                if (!res1.length)
                    resolve(out);
                else
                    loadSingleUser(0);
            });
        });
    };
    User.comparePassword = function(hash,password) {
        return bcrypt.compareSync(hash, password);
    };
    User.hashPassword = function(password) {
        return bcrypt.hashSync(password, 10);
    };
    User.removeById = function(id) {
        let getUserById = function() {
            return new Promise(function(resolve1,reject1) {
                redis_client.hgetall("user:"+id,function(err0,resHget0) {
                    if (err0 || !resHget0)
                        reject1(err0?err0:1000);
                    else
                        resolve1(resHget0);
                });
            });
        }
        let delSomething = function(what,err) {
            return new Promise(function(resolve1,reject1) {
                redis_client.del(what,function(err0,resDel) {
                    if ((err0 || !resDel) && err)
                        reject1(err0?err0:err);
                    else
                        resolve1();
                });
            });
        }
        let sremSomething = function(what,item,err) {
            return new Promise(function(resolve1,reject1) {
                redis_client.srem(what,item,function(err0,resDel) {
                    if (err0 || !resDel)
                        reject1(err0?err0:err);
                    else
                        resolve1();
                });
            });
        }
        var foundUser = null;
        return getUserById().then(function(resHget0) {
            foundUser = resHget0;
            return sremSomething("user:validusers",id,2000);
        }).then(function() {
            return delSomething("user:"+id,3000);
        }).then(function() {
            return delSomething("user:options:"+id,3500);
        }).then(function() {
            return delSomething("user:filters:"+id,0);
        }).then(function() {
            return delSomething("user:username:"+foundUser["username"],id,6000);
        });
    };
    User.findOne = function(obj) {
        return User.findM(obj,1).then(function(res) {
            return res && res.length?res[0]:null;
        });
    };
    User.authenticate = function(username,password,enc) {
        return User.findOne({"username":username}).then(function(us) {
            if ((enc && password==us.password) || (!enc && User.comparePassword(password,us.password)))
                return us;
            else
                throw 345;
        });
    };
    User.findById = function(id) {
        return User.findOne({"uid":id});
    };
    User.findM = function(obj,num) {
        let resolve;
        let reject;
        let prom = new Promise(function(iresolve,ireject) {
            resolve = iresolve;
            reject = ireject;
        });
        let searchall = function(err0,res0) {
            if (err0 || !res0 || res0.constructor !== Array || res0.length==0)
                reject(err0?err0:2000);
            else {
                var out = [];
                var funadd = function(idx) {
                    let myid = res0[idx]
                    redis_client.hgetall("user:"+myid,function(err1,res1) {
                        if (!err1 && res1) {
                            redis_client.hgetall("user:options:"+myid,function(err2,res2) {
                                if (!err2 && res2) {
                                    res2.filters = [];
                                    redis_client.smembers("user:filters:"+myid,function(err3,res3) {
                                        if (!err3 && res3) {
                                            res2.filters = res3;
                                        }
                                        res1.options = res2;
                                        out.push(new User(res1));
                                        console.log(JSON.stringify(res1));
                                        if ((num<=0 || out.length!=num) && idx+1<res0.length)
                                            funadd(idx+1);
                                        else
                                            resolve(out);
                                    });
                                }
                                else {
                                    if ((num<=0 || out.length!=num) && idx+1<res0.length)
                                        funadd(idx+1);
                                    else
                                        resolve(out);
                                }
                            });
                        }
                        else {
                            if ((num<=0 || out.length!=num) && idx+1<res0.length)
                                funadd(idx+1);
                            else
                                resolve(out);
                        }
                    });
                }
                funadd(0);
            }
        };
        if (obj.hasOwnProperty('uid') && obj.uid!==null) {
            searchall(null,[obj.uid]);
        }
        else {
            let ks = Object.keys(obj);
            let listids = [];
            let src = function(n) {
                if (n<ks.length) {
                    redis_client.get("user:"+ks[n]+":"+obj[ks[n]],function (err3,res3) {
                        if (!err3 && res3!==null)
                            listids.push(res3);
                        src(n+1);
                    });
                }
                else {
                    if (listids.length) {
                        console.log("IDS found "+JSON.stringify(listids));
                        searchall(null,listids);
                    }
                    else
                        reject(550);
                }
            };
            src(0);
            /*let argc = 0;
            let argv = [];
            let sinterargv = "";
            Object.keys(obj).forEach(function(key) {
                argv.push(key+":"+obj[key]);
                sinterargv+="argv["+argc+"],";
                argc++;
            });
            if (argc>0) {
                sinterargv="redis_client.sinter("+sinterargv+"searchall)";
                eval(sinterargv);
                //redis_client.sinter.apply(null,argv);
            }
            else
                return Promise.reject(1000);*/
        }
        return prom;
    };
    return User;
})();
module.exports = User;
