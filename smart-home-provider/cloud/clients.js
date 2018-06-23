const redis_client = require('./redisconf');

var Client = (function(){
    var Client = function (us) {
        var that = this;
		that.stringid = us.hasOwnProperty('stringid')?us.stringid:null;
		that.apikey = us.hasOwnProperty('apikey')?us.apikey:null;
        that.secret = us.hasOwnProperty('secret')?us.secret:null;
        that.username = us.hasOwnProperty('username')?us.username:null;

		that.save = function() {
            let hmSetClient = function() {
                return new Promise(function(resolve1,reject1) {
                    redis_client.hmset("client:"+that.stringid,
                        "stringid", that.stringid,
                        "username", that.username,
                        "apikey", that.apikey,
                        "secret", that.secret, function (err3,resHMSet3) {
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
                        if (err4 || resSadd4!="OK")
                            reject1(err4?err4:err);
                        else
                            resolve1(that);
                    });
                });
            }
            return Client.stringidTaken(that.stringid).then(function (taken) {
                if (taken)
                    throw 1500;
                else {
                    return Client.usernameTaken(that.username).then(function(taken2) {
                        if (taken2)
                            throw 2500;
                        else {
                            return hmSetClient()
                                  .then(function(cl) {
                                    return vSadd(that.stringid,"client:validclients",3000);
                                }).then(function(cl) {
                                    return vSet(that.stringid,"client:username:"+that.username,7000);
                                });
                        }
                    });
                }
            });
        }
    };
    Client.stringidTaken = function(us) {
        return new Promise(function (resolve1,reject1) {
            redis_client.get("client:"+us, function (err1, maxid) {
                resolve1(maxid!=null);
            });
        });
    };
    Client.usernameTaken = function(us) {
        return new Promise(function (resolve1,reject1) {
            redis_client.get("client:username:"+us, function (err1, maxid) {
                resolve1(maxid!=null);
            });
        });
    };
	Client.removeById = function(id) {
        let getClientById = function() {
            return new Promise(function(resolve1,reject1) {
                redis_client.hgetall("client:"+id,function(err0,resHget0) {
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
        var foudClient = null;
        return getClientById().then(function(resHget0) {
            foundClient = resHget0;
            return sremSomething("client:validclients",id,2000);
        }).then(function() {
            return delSomething("client:"+id,3000);
        }).then(function() {
            return delSomething("client:username:"+foundClient["username"],5000);
        });
	};
	Client.findOne = function(obj) {
		return Client.findM(obj,1).then(function(res) {
            console.log("[ClientsFindone] exit "+JSON.stringify(res));
            return res && res.length?res[0]:null;
        });
	};
	Client.findById = function(id) {
		return Client.findOne({"stringid":id});
	};

    Client.findAll = function() {
        return new Promise(function(resolve,reject) {
            redis_client.smembers("client:validclients",function(err3,res3) {
                if (!err3 && res3) {
                    out = [];
                    let findid = function(idx) {
                        if (idx<res3.length) {
                            console.log("[ClientFindAll] findbyid "+res3[idx]);
                            Client.findById(res3[idx]).then(
                                function(c) {
                                    out.push(c);
                                    findid(idx+1);
                                }
                            ).catch(function(err4) {
                                findid(idx+1);
                            })
                        }
                        else if (out.length)
                            resolve(out);
                        else
                            reject(400);
                    }
                    findid(0);
                }
                else
                    reject(err3);
            });
        });
    };
    Client.findByUsername = function(id) {
		return Client.findOne({"username":id});
	};
	Client.findM = function(obj,num) {
        let resolve;
        let reject;
        let prom = new Promise(function(iresolve,ireject) {
            resolve = iresolve;
            reject = ireject;
        });
		let searchall = function(err0,res0) {
            console.log("[ClientFindm] sono qui "+err0+" "+JSON.stringify(res0));
            if (err0 || !res0 || res0.constructor !== Array || res0.length==0)
				reject(err0?err0:2000);
            else {
                var out = [];
				var funadd = function(idx) {
                    let myid = res0[idx]
					redis_client.hgetall("client:"+myid,function(err1,res1) {
						if (!err1 && res1) {
							out.push(new Client(res1));
							console.log(JSON.stringify(res1));
                        }
                        if ((num<=0 || out.length!=num) && idx+1<res0.length)
                            funadd(idx+1);
                        else
                            resolve(out);
                    });
				}
				funadd(0);
            }
		};
		if (obj.hasOwnProperty('stringid') && obj.stringid!==null)
            searchall(null,[obj.stringid]);
		else {
            let ks = Object.keys(obj);
            let listids = [];
            let src = function(n) {
                if (n<ks.length) {
                    redis_client.get("client:"+ks[n]+":"+obj[ks[n]],function (err3,res3) {
                        if (!err3 && res3!==null) {
                            listids.push(res3);
                        }
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
        }
        return prom;
    };
    return Client;
})();
module.exports = Client;
