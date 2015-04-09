var RPC = (function () {

    function RPC(guid, key) {

        var self = this;

        /** private variables */
        var procedures = {};            // procs provided by me; [func: string]=>{f: function, t: any?}
        var available = {};             // procs provided to me; [peer: string]=>{
                                        //                          [callName:string]=>{
                                        //                              [callId:number]=> {cb: function?, rs: any?}
                                        //                          }
                                        //                      }
        var invCounter = 0;
        var conns = {};                 // peerID -> PeerJS.Peer
        var me = new Peer(guid, { key: key });

        /** private functions */
        var _provideOnce = function (name, conn) {
            conn.send({
                type: "provide-procedure",
                name: name,
                from: me.id
            });
        };
        var _provideAll = function (conn) {
            for (var name in procedures) {
                _provideOnce(name, conn);
            }
        };
        var _onConnection = function (conn) {

            if (conn.peer in conns) {
                console.error("Saw connection event for peer " + conn.peer + " twice. Ignoring.");
                return;
            }

            conn.on('close', function () {
                self.onDisconnect && self.onDisconnect(conn.peer);
                delete conns[conn.peer];
                delete available[conn.peer];
            });

            conn.on('error', function (e) {
                console.error(e);
            });

            conn.on('open', function () {
                _provideAll(conn);
                conns[conn.peer] = conn;
            });
            conn.on('data', function (data) {

                if (data.type === "rpc-call") {
                    // data = { args: any[], callId: number, from: string, call: string }
                    var args = data.args.slice();

                    var procInfo = procedures[data.call];

                    var _func = procInfo.f;
                    var _this = procInfo.t;

                    var result = _func.apply(_this, args);

                    conn.send({
                        type: "rpc-response",
                        call: data.call,
                        from: me.id,
                        callId: data.callId,
                        response: result
                    });

                } else if (data.type === "rpc-response") {
                    // data = { call: string, callId: number, from: string, response: any }
                    var response = data.response;

                    var callEntry = available[data.from][data.call];
                    var callback = callEntry[data.callId];

                    if (callback) {
                        callback(response);
                        delete callEntry[data.callId];
                    }

                } else if (data.type === "provide-procedure") {
                    // data = { name: string, from: string }
                    if (!(data.from in available)) available[data.from] = {};
                    if (data.name in available[data.from]) console.error("Peer " + conn.peer + " attempting to provide " + data.name + " twice.");
                    available[data.from][data.name] = {};
                }

            });
            self.onDiscover && self.onDiscover(conn.peer);
        };
        var _sendCall = function (conn, name, args) {
            var invc = ++invCounter;
            conn.send({
                type: "rpc-call",
                args: args,
                call: name,
                from: me.id,
                callId: invc
            });
            return invc;
        };
        var _setCallback = function (conn, name, invc, cb) {
            available[conn.peer][name][invc] = cb;
            // don't worry about ordering issues between set callback and send call;
            // javascript is single threaded. this is only a problem if someone sets
            // a callback in an async callback; we don't want to support this on the
            // expense of a simpler common case. Thus, always assume .r
        };

        /**
         * @param name - string: the name of the function; allows us to call the function as rpc.name()
         * @param func - function: the RPC function
         * @param _this - OPTIONAL Object: the object to be 'this'
         */
        this.provide = function (name, func, _this) {
            var peerId;

            if (name in procedures) console.error("Overriding provided function call '" + name + "'");
            procedures[name] = { f: func, t: _this };

            for (peerId in conns) {
                if (!conns.hasOwnProperty(peerId)) continue;
                _provideOnce(name, conns[peerId]);
            }
        };

        this.with = function (peerId) {
            var ret = {};
            var conn = conns[peerId];

            for (key in available[peerId]) {
                if (!available[peerId].hasOwnProperty(key)) continue;

                ret[key] = (function (name) {
                    return function () {
                        var invc = _sendCall(conn, name, Array.prototype.slice.call(arguments));
                        var _onSuccess = function (f) {
                            _setCallback(conn, name, invc, f);
                        };
                        return {
                            then: _onSuccess,
                            onSuccess: _onSuccess
                        };
                    };
                })(key);

            }
            return ret;
        };
        this.connect = function (peerId) {
            var conn = me.connect(peerId);
            _onConnection(conn);
        };
        this.disconnect = function (peerId) {
            if ((peerId in conns) && conns[peerId]) {
                conns[peerId].close();
                delete conns[peerId];
                delete available[peerId];
            }
        }

        // Initialization
        me.on('error', function (e) {
            if (e && e.message && e.message.substr(0, 17) === 'Could not connect') return;
            console.error(e.message);
        });

        me.on('connection', _onConnection);



    };
    return RPC;
})();
