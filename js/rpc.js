var guid = function () {

    var s4 = function () {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4();
}

var RPC = function (_guid) {

    var RpcReturn = function (rpc, uid, callTime) {

        this.callTime = callTime;
        this.rpc = rpc;
        this.uid = uid;

        /// takes function(result){}
        this.onSuccess = function (func) {
            if (rpc.pending[uid] === undefined) {
                if (new Date() - callTime <= 500) {
                    var _this = this;
                    window.setTimeout(function () { _this.onSuccess(func); }, 100);
                }
            } else {
                func(rpc.pending[uid]);
            }
            return this;
        };

        /// takes function(){}
        this.onFailure = function (func) {
            if (rpc.pending[uid] === undefined) {
                if (new Date() - this.callTime > 500) {
                    func();
                } else {
                    var _this = this;
                    window.setTimeout(function () { _this.onFailure(func); }, 100);
                }
            }
            return this;
        };
    };

    var __rpc = this;
    this.status = true;

    this.receive = new Object();
    this._functions = new Object();
    this.call = new Object();
    this.peers = new Object();
    this.pending = new Object(); // pending calls which have not returned.

    var my_guid;
    if (_guid === undefined) { my_guid = guid(); }
    else { my_guid = _guid; }

    this.me = new Peer(my_guid, { key: 'elszxxookm1v2t9' });

    this.me.on('error', function (e) {
        if (!e || (e.message && e.message.substr(0,17) === 'Could not connect')) return;
        console.log({error: arguments});
    });

    /**
     * @param name - string: the name of the function; allows us to call the function as rpc.name()
     * @param func - function: the RPC function
     * @param _this - OPTIONAL Object: the object to be 'this'
     */
    this.register = function (name, func, _this) {
        __rpc.call[name] = function () {
            var callUid = guid();
            peerId = arguments[0];
            args = [].splice.call(arguments, 0);
            args.splice(0, 1);

            __rpc.pending[callUid] = undefined;

            if (__rpc.peers[peerId]) {

                __rpc.peers[peerId].send({
                    "type": "rpc-call",
                    "call": name,
                    "args": args,
                    "from": __rpc.me.id,
                    "uid": callUid
                });
            }

            return new RpcReturn(__rpc, callUid, new Date());
        };
        __rpc[name] = __rpc.call[name]; // rpc.funcA is a shorthand for rpc.call.funcA;
        __rpc._functions[name] = func;
        __rpc.receive[name] = function (from, uid, args) {

            var __this = null;
            if (__this !== undefined) { __this = this; }
            var retval = __rpc._functions[name].apply(__this, args);
            var conn = __rpc.peers[from];

            conn.send({
                "type": "rpc-response",
                "call": name,
                "reply": retval,
                "uid": uid
            });
        };

        return __rpc[name]; // rpc.register() returns the function so we can save it in objects
    };
    this.with = function (peerId) {
        var ret = new Object();
        for (key in __rpc.call) {

            (function (R, K) {
                R[K] = function () {
                    var args = [peerId];
                    for (arg in arguments) { args.push(arguments[arg]); }
                    return __rpc.call[K].apply(__rpc, args);
                };

            })(ret, key);
        }
        return ret;
    };
    this.connect = function (peerId) {
        if (!this.status) return;
        var conn = __rpc.me.connect(peerId);
        if (conn) {
            conn.on('open', function () {
                __rpc.peers[peerId] = conn;
            });
        } else {
            delete __rpc.peers[peerId];
        }
        return true;
    };
    this.disconnect = function (peerId) {
        if (__rpc.peers[peerId] !== undefined && __rpc.peers[peerId] !== null) {
            __rpc.peers[peerId].close();
            delete __rpc.peers[peerId];
        }
    }

    // these two methods are for testing only
    this.offline = function () {
        this.status = false;
        __rpc.me.destroy();
        __rpc.peers = new Object();
    };
    this.online = function () {
        this.status = true;
        __rpc.me = new Peer(my_guid, { key: 'elszxxookm1v2t9' });
        onNewRPC();
    };

    // on new RPC
    var onNewRPC = function () {
        __rpc.me.on('connection', function (conn) {
            if (__rpc.peers[conn.peer] === undefined) {
                __rpc.peers[conn.peer] = __rpc.me.connect(conn.peer);

                __rpc.peers[conn.peer].on('open', function () {
                    if (__rpc.onDiscover) {
                        __rpc.onDiscover(conn.peer);

                    }
                });
            }

            conn.on('close', function () {
                delete __rpc.peers[conn.peer];
                if (__rpc.onDisconnect) {
                    __rpc.onDisconnect(conn.peer);
                }
            });

            conn.on('data', function (data) {
                if (data.type === "rpc-call") {
                    var passedArgs = [];
                    for (key in data.args) { passedArgs.push(data.args[key]); }
                    __rpc.receive[data["call"]](data.from, data.uid, passedArgs);
                } else if (data.type === "rpc-response") {
                    __rpc.pending[data.uid] = data.reply;
                }
            });

        });
    };

    onNewRPC();
};
