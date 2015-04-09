PeerRPC Quick Guide
===================

A lightweight RPC Library built on top of Peer.js

While PeerJS provides marshalling of JavaScript objects to and from a compact binary serialization format, the focus of PeerRPC library is to provide an interface that is transparent yet simple to use.

Procedure calls
---------------

For example, to provide a procedure call:
```javascript
rpc.provide("functionName", function(args..) {
  ...
  return retval;
});
```

On the other side, you can call a provided procedure by:
```javascript
rpc.with(peerID).functionName(args...);
```

Since it is undesirable for interactive JS applications to block on I/O functions until they return or fail, we interact with return values using callbacks:

```javascript
rpc.with(toPeer).functionName(args...)
  .then(function(retVal) {
    ...
  });
```

PeerRPC also allows the `rpc.provide()` method to set a `this` variable to be used by the function when the procedure is called. For example:

```javascript
function Car(name) {
  this.name = name;
}
Car.prototype.honk = function() {
  alert(this.name + " honks!");
};
var joeTheCar = new Car("joe");
rpc.provide("honk_joe", joeTheCar.honk, joeTheCar /* thisArg */);
```
On the other side, we can do:

```javascript
rpc.with(peerId).honk_joe();
```

API Documentation
-----------------

### RPC

#### rpc.provide(name, func [, _this])
* `name: string`
* `func: (any...)=>any`
* `_this: any?`

**Returns** `undefined`.

### rpc.with(peerId)
* `peerId: string`

**Returns** `{ [procName: string] => { then: (response: any)=>any } }` &mdash; dictionary of "procedures" that, if called, issue an RPC to a particular peer we are connected to (as signified by `peerId`) and returns a promise-like object which could be use to attach a callback with the return value.

### rpc.connect(peerId)
* `peerId: string`

Connects with a peer with the given `peerId`.

**Returns** `undefined`.

### rpc.disconnect(peerId)
* `peerId: string`

Terminates a connection with a peer with the given `peerId`.

**Returns** `undefined`.
