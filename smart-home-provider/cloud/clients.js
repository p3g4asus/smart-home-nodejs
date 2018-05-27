const redis_client = require('./redisconf');

var Client = (function(){
    var Client = function (us) {
        var that = this;
        that._id = us.hasOwnProperty('_id')?us._id:null;
		that.stringid = us.hasOwnProperty('stringid')?us.stringid:null;
		that.apikey = us.hasOwnProperty('apikey')?us.apikey:null;
        that.secret = us.hasOwnProperty('secret')?us.secret:null;
        that.username = us.hasOwnProperty('username')?us.username:null;

		that.save = function() {
            let setMaxId = function(nextid) {
                return new Promise(function(resolve1,reject1) {
                    redis_client.set("client:maxid",""+(nextid+1),function(err2,resSet2) {
                        if (err2 || resSet2.indexOf("OK")<0)
                            reject1(err2?err2:1000);
                        else
                            resolve1(that);
                    });
                });
            }
            let hmSetClient = function(nextid) {
                return new Promise(function(resolve1,reject1) {
                    redis_client.hmset("client:"+nextid,
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
                            var nextid = 0;
                            return Client.getMaxId()
                                .then(function(nid) {
                                    nextid = nid;
                                    that._id = nid;
                                    return setMaxId(nextid);
                                }).then(function(cl) {
                                    return hmSetClient(nextid);
                                }).then(function(cl) {
                                    return vSadd(nextid,"client:validclients",3000);
                                }).then(function(cl) {
                                    return vSet(nextid,"client:stringid:"+that.stringid,6000);
                                }).then(function(cl) {
                                    return vSet(nextid,"client:username:"+that.username,7000);
                                });
                        }
                    });
                }
            });
        }
    };
    Client.getMaxId = function() {
        return new Promise(function (resolve1,reject1) {
            redis_client.get("client:maxid", function (err1, maxid) {
                if (maxid==null)
                    maxid = '0';
                let nextid = parseInt(maxid);
                resolve1(nextid);
            });
        });
    };
    Client.stringidTaken = function(us) {
        return new Promise(function (resolve1,reject1) {
            redis_client.get("client:stringid:"+us, function (err1, maxid) {
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
        function getClientById() {
            return new Promise(function(resolve1,reject1) {
                redis_client.hgetall("client:"+id,function(err0,resHget0) {
        			if (err0 || !resHget0)
        				reject1(err0?err0:1000);
                    else
                        resolve1(resHget0);
                });
            });
        }
        function delSomething(what,err) {
            return new Promise(function(resolve1,reject1) {
                redis_client.del(what,function(err0,resDel) {
        			if ((err0 || !resDel) && err)
        				reject1(err0?err0:err);
                    else
                        resolve1();
                });
            });
        }
        function sremSomething(what,item,err) {
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
            return delSomething("client:stringid:"+foundClient["stringid"],4000);
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
		return Client.findOne({"_id":id});
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
                            Object.assign(res1, {"_id":myid});
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
		if (obj.hasOwnProperty('_id') && obj._id!==null) {
			return searchall(null,[obj._id]);
		}
		else {
            let ks = Object.keys(obj);
            let listids = [];
            let src = function(n) {
                if (n<ks.length) {
                    redis_client.get("client:"+ks[n]+":"+obj[ks[n]],function (err3,res3) {
                        if (!err3 && res3!==null) {
                            let id = 0;
                            try {
                                id = parseInt(res3);
                                listids.push(id);
                            }
                            catch(err) {
                                console.log(err.stack);
                            }
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
            return prom;
		}
	};
    return Client;
})();
module.exports = Client;
