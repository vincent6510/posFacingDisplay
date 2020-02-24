import { Component, NgZone, ViewChild } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Platform, AlertController } from '@ionic/angular';
import { NetworkInterface } from '@ionic-native/network-interface/ngx';

declare var cordova: any;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  localIPAddress: string = '';
  listeningPort: string = '';
  connectionStatus: string = '';
  currConnUuid : string = '';
  currConn : any;
  msgArr = [];
  clientConnected: boolean = false;
  clientName: string = '';
  showSettings: boolean = false;
  
  @ViewChild('cartList', {static: true}) cartList:any;

  constructor(public platform: Platform, public ngZone: NgZone,
    private networkInterface: NetworkInterface,
    private alertController: AlertController) {}

  ngOnInit() {
    
    this.platform.ready().then(() => {
      this.startSocketServer();
      this.networkInterface.getWiFiIPAddress()
      .then(address => this.localIPAddress = address.ip)
      .catch(error => console.error('Unable to get IP: ${error}'));
    });
    
    // let app = require('express')();
    // let server = require('http').createServer(app);
    // let io = require('socket.io')(server);
    // io.on('connection', (socket) => {
    //   socket.on('set-name', (name) => {
    //     console.log('set-name : ' + name);  
    //   });
    // });
    
    // var port = process.env.PORT || 3001;
    
    // server.listen(port, function(){
    //   console.log('listening in http://localhost:' + port);
    // });
  }

  startSocketServer() {
    var that = this;
    var wsserver = cordova.plugins.wsserver;
    wsserver.start('8888', {
      // WebSocket Server handlers
      'onFailure' :  function(addr, port, reason) {
          console.log('Stopped listening on %s:%d. Reason: %s', addr, port, reason);
          that.ngZone.run(() => {
            that.connectionStatus = 'Stopped listening on ' + port + '. Reason: ' + reason;
          });
      },
      // WebSocket Connection handlers
      'onOpen' : function(conn) {
          /* conn: {
           'uuid' : '8e176b14-a1af-70a7-3e3d-8b341977a16e',
           'remoteAddr' : '192.168.1.10',
           'httpFields' : {...},
           'resource' : '/?param1=value1&param2=value2'
           } */
          console.log('A user connected from %s', conn.remoteAddr);
          that.msgArr.push('A user connected from ' + conn.remoteAddr);
          //console.log(conn);
          //console.log(conn.httpFields);
          that.currConn = conn;
          that.currConnUuid = conn.uuid;
          that.clientConnected = true;
                    
          //webpack:///./node_modules/ngx-socket-io/node_modules/engine.io-parser/lib/browser.js
          // /**
          //  * Packet types.
          //  */
          // var packets = exports.packets = {
          //   open:     0    // non-ws
          // , close:    1    // non-ws
          // , ping:     2
          // , pong:     3
          // , message:  4
          // , upgrade:  5
          // , noop:     6
          // };
          //acknowledge client side for open connection information
          //data must be in json format {"data":"aa","moredata":"bb"}
          wsserver.send(conn, '0{"sid":"'+conn.uuid+'", "upgrades":["websocket"], "pingInterval":600000, "pingTimeout":600000}');
          
          //webpack:///./node_modules/ngx-socket-io/node_modules/socket.io-client/lib/socket.js
          // /**
          //  * Internal events (blacklisted).
          //  * These events can't be emitted by the user.
          //  *
          //  * @api private
          //  */
          // var events = {
          //   connect: 1,
          //   connect_error: 1,
          //   connect_timeout: 1,
          //   connecting: 1,
          //   disconnect: 1,
          //   error: 1,
          //   reconnect: 1,
          //   reconnect_attempt: 1,
          //   reconnect_failed: 1,
          //   reconnect_error: 1,
          //   reconnecting: 1,
          //   ping: 1,
          //   pong: 1
          // };
          //acknowledge client for connected status
          //packet type + event
          //40 = 4+0 (message + connect)
          //data must be in array format ["a","b","c"]
          wsserver.send(conn, '40["connected"]');
          
      },
      'onMessage' : function(uuid, msg) {
          console.log('onMessage');
          // console.log(uuid, msg);
          that.ngZone.run(() => {
            that.processIncomingMsg(msg);
            that.msgArr.push(msg);
          });
          // console.log(that.msgArr);
      },
      'onClose' : function(conn, code, reason, wasClean) {
          console.log('A user disconnected from %s', conn.remoteAddr);
          that.clientConnected = false;
      },
      // Other options
      // 'origins' : [ 'http://localhost:8200' ], // validates the 'Origin' HTTP Header.
      //'origins' : [ '*:*' ], // validates the 'Origin' HTTP Header.
      //'protocols' : [ 'my-protocol-v1', 'my-protocol-v2' ], // validates the 'Sec-WebSocket-Protocol' HTTP Header.
      //'tcpNoDelay' : true // disables Nagle's algorithm.
      }, function onStart(addr, port) {
          that.listeningPort = addr + ':' + port;
          console.log('Listening on %s:%d', addr, port);
          that.ngZone.run(() => {
            that.connectionStatus = 'Listening on ' + port;
          });
          // console.log(wsserver);
      }, function onDidNotStart(reason) {
          console.log('Did not start. Reason: %s', reason);
          that.ngZone.run(() => {
            that.connectionStatus = 'Did not start. Reason ' + reason;
          });
      });
  }

  stopSocketServer() {
    var that = this;
    var wsserver = cordova.plugins.wsserver;
    wsserver.stop(function onStop(addr, port) {
      console.log('Stopped listening on %s:%d', addr, port);
      that.ngZone.run(() => {
        that.connectionStatus = 'Stopped listening on ' + port;
      });
    }); 
  }

  ionViewWillLeave() {
    var wsserver = cordova.plugins.wsserver;
    wsserver.stop(function onStop(addr, port) {
      console.log('Stopped listening on %s:%d', addr, port);
    }); 
  }

  sendMessage() {
    var wsserver = cordova.plugins.wsserver;
    console.log('sendMessage ', this.currConnUuid);
    //4 = message, 0 = connect
    wsserver.send(this.currConn, '4{"id":"'+this.currConnUuid+'", "data": "message from server"}');
  }

  async displayMsgQueue() {
    var message = '';
    this.msgArr.forEach(msg => {
      message += msg + '<br>';
    });
    const alert = await this.alertController.create({
      cssClass: 'my-custom-alert',
      header: 'Incomming Messages',
      message: message,
      buttons: ['OK']
    });

    await alert.present();
  }

  cart: Item[];
  total: number = 0.00;

  processIncomingMsg(msg: string) {
    var messageType = msg.substring(0, 2);
    var json = msg.substring(2);
    if (messageType == '42') {
      const contentObj = JSON.parse(json);
      var contentType = contentObj[0];
      if (contentType == 'user') {
        this.clientName = contentObj[1];
      }
      else if (contentType == 'cart') {
        this.cart = [];
        var cartItems = contentObj[1];
        // console.log(cartItems);
        for (var key in cartItems) {
          var value = cartItems[key];
          var item = new Item;
          item.sequence = parseFloat(key);
          item.description = value.description;
          item.subtotal = value.subtotal;
          this.cart.push(item);
          this.ngZone.run(() => {
            setTimeout(() => {
              this.cartList.scrollTop = this.cartList.scrollHeight;
            })
          });
        }
        console.log(this.cart);
        // cartItems.forEach(function(key, value) {
        //   this.cart.push(value);
        // });
      }
      else if (contentType == 'total') {
        this.total = contentObj[1];
      }
    }
    else {
      console.log('unknown message type.')
    }
  }

  toggleSettingsBar() {
    this.showSettings = !this.showSettings;
  }
  
}

export class Item {
  sequence: number;
  description: string;
  unit_price: number;
  subtotal: string;
}
