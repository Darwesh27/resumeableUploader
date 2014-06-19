/**
 * Socket Configuration
 *
 * These configuration options provide transparent access to Sails' encapsulated
 * pubsub/socket server for complete customizability.
 *
 * For more information on using Sails with Sockets, check out:
 * http://sailsjs.org/#documentation
 */

// This varable will hold the meta data of the file untill its completely uploaded
var Files = {},
    fs = require('fs')
	, exec = require('child_process').exec
	, util = require('util');

module.exports.sockets = {

  // This custom onConnect function will be run each time AFTER a new socket connects
  // (To control whether a socket is allowed to connect, check out `authorization` config.)
  // Keep in mind that Sails' RESTful simulation for sockets 
  // mixes in socket.io events for your routes and blueprints automatically.
  onConnect: function(session, socket) {
      
      	function emitMoreData(place) {
            socket.emit("MoreData", {"Place": place, "Percent": 0});
        }
      	socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
	        var Name = data['Name'];
	        Files[Name] = {  //Create a new Entry in The Files Variable
	            FileSize : data['Size'],
	            Data     : "",
	            Downloaded : 0
	        }
	        var Place = 0;
	        try{
	            var Stat = fs.statSync('Temp/' +  Name);
	            if(Stat.isFile())
	            {
	                Files[Name]['Downloaded'] = Stat.size;
	                Place = Stat.size / 524288;
	            }
	        }
	        catch(er){} //It's a New File
	        fs.open("Temp/" + Name, "a", 0755, function(err, fd){
	            if(err)
	            {
	                console.log(err);
	            }
	            else
	            {
	                Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
                    
                    emitMoreData(Place);
	            }
	        });
	});
	
	
	socket.on('Upload', function (data){
        
	        var Name = data['Name'];
	        Files[Name]['Downloaded'] += data['Data'].length;
	        Files[Name]['Data'] += data['Data'];
	        if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
	        {
	            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
	                //Get Thumbnail Here
					var inp = fs.createReadStream("Temp/" + Name);
					var out = fs.createWriteStream("Video/" + Name);
					util.pump(inp, out, function(){
					    fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File
					        //Moving File Completed
					    });
					});
					exec("ffmpeg -i Video/" + Name  + " -ss 01:30 -r 1 -an -vframes 1 -f mjpeg Video/" + Name  + ".jpg", function(err){
				    	socket.emit('Done', {'Image' : 'Video/' + Name + '.jpg'});
					});
	            });
	        }
	        else if(Files[Name]['Data'].length > 10485760){ //If the Data Buffer reaches 10MB
	            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
	                Files[Name]['Data'] = ""; //Reset The Buffer
	                var Place = Files[Name]['Downloaded'] / 524288;
	                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
	                socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
	            });
	        }
	        else
	        {
	            var Place = Files[Name]['Downloaded'] / 524288;
	            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
	            socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
	        }
	    });
    // By default: do nothing
    // This is a good place to subscribe a new socket to a room, inform other users that
    // someone new has come online, or any other custom socket.io logic
  },

  // This custom onDisconnect function will be run each time a socket disconnects
  onDisconnect: function(session, socket) {

    console.log("Client Gone..");
    // By default: do nothing
    // This is a good place to broadcast a disconnect message, or any other custom socket.io logic
  },



  // `transports`
  //
  // A array of allowed transport methods which the clients will try to use.
  // The flashsocket transport is disabled by default
  // You can enable flashsockets by adding 'flashsocket' to this list:
  transports: [
  'websocket',
  'htmlfile',
  'xhr-polling',
  'jsonp-polling'
  ],




  // Use this option to set the datastore socket.io will use to manage rooms/sockets/subscriptions:
  // default: memory
  adapter: 'memory',

  
  // Node.js (and consequently Sails.js) apps scale horizontally.
  // It's a powerful, efficient approach, but it involves a tiny bit of planning.
  // At scale, you'll want to be able to copy your app onto multiple Sails.js servers
  // and throw them behind a load balancer.
  //
  // One of the big challenges of scaling an application is that these sorts of clustered 
  // deployments cannot share memory, since they are on physically different machines.
  // On top of that, there is no guarantee that a user will "stick" with the same server between
  // requests (whether HTTP or sockets), since the load balancer will route each request to the 
  // Sails server with the most available resources. However that means that all room/pubsub/socket
  // processing and shared memory has to be offloaded to a shared, remote messaging queue (usually Redis)
  //
  // Luckily, Socket.io (and consequently Sails.js) apps support Redis for sockets by default.
  // To enable a remote redis pubsub server: 
  // adapter: 'redis',
  // host: '127.0.0.1',
  // port: 6379,
  // db: 'sails',
  // pass: '<redis auth password>'
  // Worth mentioning is that, if `adapter` config is `redis`, 
  // but host/port is left unset, Sails will try to connect to redis 
  // running on localhost via port 6379 



  // `authorization`
  //
  // Global authorization for Socket.IO access, 
  // this is called when the initial handshake is performed with the server.
  // 
  // By default (`authorization: true`), when a socket tries to connect, Sails verifies
  // that a valid cookie was sent with the upgrade request.  If the cookie doesn't match
  // any known user session, a new user session is created for it.
  //
  // However, in the case of cross-domain requests, it is possible to receive a connection
  // upgrade request WITHOUT A COOKIE (for certain transports)
  // In this case, there is no way to keep track of the requesting user between requests,
  // since there is no identifying information to link him/her with a session.
  //
  // If you don't care about keeping track of your socket users between requests,
  // you can bypass this cookie check by setting `authorization: false`
  // which will disable the session for socket requests (req.session is still accessible 
  // in each request, but it will be empty, and any changes to it will not be persisted)
  //
  // On the other hand, if you DO need to keep track of user sessions, 
  // you can pass along a ?cookie query parameter to the upgrade url, 
  // which Sails will use in the absense of a proper cookie
  // e.g. (when connection from the client):
  // io.connect('http://localhost:1337?cookie=smokeybear')
  //
  // (Un)fortunately, the user's cookie is (should!) not accessible in client-side js.
  // Using HTTP-only cookies is crucial for your app's security.
  // Primarily because of this situation, as well as a handful of other advanced
  // use cases, Sails allows you to override the authorization behavior 
  // with your own custom logic by specifying a function, e.g:
  /*
    authorization: function authorizeAttemptedSocketConnection(reqObj, cb) {

        // Any data saved in `handshake` is available in subsequent requests
        // from this as `req.socket.handshake.*`

        //
        // to allow the connection, call `cb(null, true)`
        // to prevent the connection, call `cb(null, false)`
        // to report an error, call `cb(err)`
    }
  */
  authorization: true,

  // Match string representing the origins that are allowed to connect to the Socket.IO server
  origins: '*:*',

  // Should we use heartbeats to check the health of Socket.IO connections?
  heartbeats: true,

  // When client closes connection, the # of seconds to wait before attempting a reconnect.
  // This value is sent to the client after a successful handshake.
  'close timeout': 60,

  // The # of seconds between heartbeats sent from the client to the server
  // This value is sent to the client after a successful handshake.
  'heartbeat timeout': 60,

  // The max # of seconds to wait for an expcted heartbeat before declaring the pipe broken
  // This number should be less than the `heartbeat timeout`
  'heartbeat interval': 25,

  // The maximum duration of one HTTP poll-
  // if it exceeds this limit it will be closed.
  'polling duration': 20,

  // Enable the flash policy server if the flashsocket transport is enabled
  // 'flash policy server': true,

  // By default the Socket.IO client will check port 10843 on your server 
  // to see if flashsocket connections are allowed.
  // The Adobe Flash Player normally uses 843 as default port, 
  // but Socket.io defaults to a non root port (10843) by default
  //
  // If you are using a hosting provider that doesn't allow you to start servers
  // other than on port 80 or the provided port, and you still want to support flashsockets 
  // you can set the `flash policy port` to -1
  'flash policy port': 10843,

  // Used by the HTTP transports. The Socket.IO server buffers HTTP request bodies up to this limit. 
  // This limit is not applied to websocket or flashsockets.
  'destroy buffer size': '10E7',

  // Do we need to destroy non-socket.io upgrade requests?
  'destroy upgrade': true,

  // Should Sails/Socket.io serve the `socket.io.js` client? 
  // (as well as WebSocketMain.swf for Flash sockets, etc.)
  'browser client': true,

  // Cache the Socket.IO file generation in the memory of the process
  // to speed up the serving of the static files.
  'browser client cache': true,

  // Does Socket.IO need to send a minified build of the static client script?
  'browser client minification': false,

  // Does Socket.IO need to send an ETag header for the static requests?
  'browser client etag': false,

  // Adds a Cache-Control: private, x-gzip-ok="", max-age=31536000 header to static requests, 
  // but only if the file is requested with a version number like /socket.io/socket.io.v0.9.9.js.
  'browser client expires': 315360000,

  // Does Socket.IO need to GZIP the static files?
  // This process is only done once and the computed output is stored in memory. 
  // So we don't have to spawn a gzip process for each request.
  'browser client gzip': false,

  // Optional override function to serve all static files, 
  // including socket.io.js et al.
  // Of the form :: function (req, res) { /* serve files */ }
  'browser client handler': false,

  // Meant to be used when running socket.io behind a proxy. 
  // Should be set to true when you want the location handshake to match the protocol of the origin. 
  // This fixes issues with terminating the SSL in front of Node 
  // and forcing location to think it's wss instead of ws.
  'match origin protocol': false,

  // Direct access to the socket.io MQ store config
  // The 'adapter' property is the preferred method
  // (`undefined` indicates that Sails should defer to the 'adapter' config)
  store: undefined,

  // A logger instance that is used to output log information.
  // (`undefined` indicates deferment to the main Sails log config)
  logger: undefined,

  // The amount of detail that the server should output to the logger.
  // (`undefined` indicates deferment to the main Sails log config)
  'log level': undefined,

  // Whether to color the log type when output to the logger.
  // (`undefined` indicates deferment to the main Sails log config)
  'log colors': undefined,

  // A Static instance that is used to serve the socket.io client and its dependencies.
  // (`undefined` indicates use default)
  'static': undefined,

  // The entry point where Socket.IO starts looking for incoming connections. 
  // This should be the same between the client and the server.
  resource: '/socket.io'

};