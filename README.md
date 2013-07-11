PeerRPC Quick Guide
===================

A lightweight RPC Library built on top of Peer.js

While PeerJS provides marshalling of JavaScript objects to and from a compact binary serialization format, the focus of PeerRPC library is to provide an interface that is transparent yet simple to use.

Procedure calls
---------------

For example, to register a function:
```javascript
  rpc.register("functionName", function(args..) {
    ...
    return retval;
  });
```

Now you can call this function by:
```javascript
  rpc.functionName(toPeer, args...);
  // or:
  rpc.with(toPeer ).functionName(args...);
```

Further, since it is difficult and typically undesirable for interactive JS applications to block on I/O functions until they return or fail, we provide a callback registration system too:

```javascript
	rpc.with(toPeer).functionName(args...)
		.onSuccess(function(retVal) {
      ...
    })
		.onFailure(function() {
      ...
    });
```

Method calls
------------

In addition to allowing you to register functions to the **rpc** variable, PeerRPC allows you to make RPC method calls, though you need to think hard about the implications of creating an RPC function for an instnace. Specifically, the use of the **this** keyword inside of an RPC function can be confusing at best.

To register a method as follows:

```javascript
  var Class = function() {
    this.methodName = rpc.register(
      "functionName", // becomes useless for calling, mostly useful for internal purposes
      function(args..) {
        ..
        return retval;
      }, this);
  };
  
  // now, if Class is instantiated:
  var obj = new Class();
  
  // we can call:
  obj.methodName(..., peerId);
  // and:
  obj.methodName(..., peerId).onSuccess(function(retVal) { ... }).onFailure(function() { ... });
```
