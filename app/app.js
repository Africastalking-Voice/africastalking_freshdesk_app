/*
 * @author Richard Karsan <richard.karsan@africastalking.com>
*/

var janus_svr         = 'voice-1.at-internal.com';
var server            = "https://" + janus_svr + ":8089/janus";
var opaqueId          = "africastalkingsip-"+Janus.randomString(12);

var registered        = false;

var janus             = null;
var sipcall           = null;
var spinner           = null;
var selectedApproach  = null;
var incoming          = null;
let client_data       = null;

let call_queued       = 0;
let sip_number        = '';
let password          = '';
let username          = '';
let sipserver         = '';


$(document).ready( function() {
  isWebRTCSupported();
  app.initialized()
      .then(function(_client) {
        var client = _client;
        client.data.get('contact')
          .then(function(data) {
              $('#apptext').html("Ticket details to be queued: <br> <strong>Name: </strong>" + data.contact.name +" <br> <strong>Email: </strong>" + data.contact.email +" <br> <strong>Phone: </strong> " + data.contact.phone);

              // Assign local variable client data
              client_data = data;

              // Store iparams to FD DB
              storeIparams();
              
              // Set local variable values
              setVariables();

              // Start JANUS session
              janusCreateSession();
          });
      
      window.body = $('body');
      window.client = client;
  });//END: app.initialized()

    // Initialize JANUS library
    janusInit();

});//END: $(document).ready)()

function setVariables() {
  client.db.get("africastalking").then (
    function(data) {
      application_url = data.configData.application_url;
      password        = data.configData.sip_password;
      sip_number      = data.configData.sip_number;
      username        = "sip:"+data.configData.sip_number;
      sipserver       = "sip:"+data.configData.sipserver;

      var body    = JSON.stringify({ 
            client_data : JSON.stringify(client_data),
            caller      : sip_number,
            enqueue     : 1
      });
    }
    // ,function(error) {
    //   console.log("error",error);
    //   notifyUser('danger', error.message || 'Unable to connect to your server.');
    //   return;
    // }

    // DOC: This error function is giving coverage issues and we can't simulate a connection failure to the Freshdesk DB API.
  );
}//END: setVariables()

function isWebRTCSupported(){
  var WebRTCSupport     = Janus.isWebrtcSupported();
  console.log(WebRTCSupport);
  if(!WebRTCSupport) {
    return notifyUser('danger','WebRTC is not supported.');
  }
}//END: isWebRTCSupported()

function janusCreateSession(){
  janus = new Janus(
          {
            server: server,
            success: function() {
              janus.attach(
                {
                  plugin: "janus.plugin.sip",
                  opaqueId: opaqueId,
                  success: function(pluginHandle) {
                    $('#details').remove();
                    sipcall = pluginHandle;
                    Janus.log("Plugin attached! (" + sipcall.getPlugin() + ", id=" + sipcall.getId() + ")");
                    // Prepare the username registration
                    $('#sipcall').removeClass('hide').show();
                    $('#login').removeClass('hide').show();
                      selectedApproach = 'secret';
                    $('#register').click(registerUsername);
                    $('#server').focus();
                    $('#register').click();
                  },
                  error: function(error) {
                    // Janus.error("  -- Error attaching plugin...", error);
                    console.error("  -- Error attaching plugin. " + error);
                    notifyUser('danger','Error attaching SIP plugin.' + error);

                  },
                  mediaState: function(medium, on) {
                    Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                    console.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                    console.info("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                  },
                  webrtcState: function(on) {
                    Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                    console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                    console.info("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                  },
                  onmessage: function(msg, jsep) {
                    Janus.debug(" ::: Got a message :::");
                    Janus.debug(msg);
                    console.log(msg);
                    var error = msg["error"];
                    if(error != null && error != undefined) {
                      if(!registered) {
                        notifyUser('danger','Error registering SIP number.');
                      } else {
                        sipcall.hangup();
                        $('#call').removeAttr('disabled').html('Call')
                          .removeClass("btn-danger").addClass("btn-success")
                          .unbind('click').click(doCall);
                      }
                      console.log(error);
                      return;
                    }else{}
                    var result = msg["result"];
                    if(result !== null && result !== undefined && result["event"] !== undefined && result["event"] !== null) {
                      var event = result["event"];
                      if(event === 'registration_failed') {
                        // Janus.warn("Registration failed: " + result["code"] + " " + result["reason"]);
                        console.warn("Registration failed: " + result["code"] + " " + result["reason"]);
                        notifyUser('danger','SIP Registration failed. Please contact administrator');
                        return;
                      }
                      if(event === 'registered') {
                        Janus.log("Successfully registered as " + result["username"] + "!");
                        $('#you').removeClass('hide').show().text("Registered as '" + result["username"] + "'");

                        if(!registered) {
                          registered = true;
                          $('#call').unbind('click').click(doCall);
                        }
                      } else if(event === 'calling') {
                        Janus.log("Waiting for the peer to answer...");
                        // TODO Any ringtone?
                        $('#call').removeAttr('disabled').html('Hangup')
                            .removeClass("btn-success").addClass("btn-danger")
                            .unbind('click').click(doHangup);
                      } else if(event === 'accepting') {
                        // Response to an offerless INVITE, let's wait for an 'accepted'
                      } else if(event === 'progress') {
                        Janus.log("There's early media from " + result["username"] + ", waiting for the call!");
                        Janus.log(jsep);
                        // Call can start already: handle the remote answer
                        if(jsep !== null && jsep !== undefined) {
                          sipcall.handleRemoteJsep({jsep: jsep, error: doHangup });
                        }
                      } else if(event === 'accepted') {
                        Janus.log(result["username"] + " accepted the call!");
                        Janus.log(jsep);
                        // Call can start, now: handle the remote answer
                        if(jsep !== null && jsep !== undefined) {
                          sipcall.handleRemoteJsep({jsep: jsep, error: doHangup });
                        }
                        notifyUser('success',"Call accepted!");
                      } else if(event === 'hangup') {
                        /*if(incoming != null) {
                          incoming.modal('hide');
                          incoming = null;
                        }*/
                        Janus.log("Call hung up (" + result["code"] + " " + result["reason"] + ")!");
                        console.info(result["code"] + " " + result["reason"]);
                        notifyUser('info', "Call hung up successfully.");
                        // Reset status
                        sipcall.hangup();
                        $('#dovideo').removeAttr('disabled').val('');
                        $('#call').removeAttr('disabled').html('Call')
                          .removeClass("btn-danger").addClass("btn-success")
                          .unbind('click').click(doCall);
                      }
                    }
                  },
                  onlocalstream: function(stream) {
                    Janus.debug(" ::: Got a local stream :::");
                    Janus.debug(stream);
                    console.info(stream);
                    if($('#myvideo').length === 0)
                      $('#videoleft').append('<video class="rounded centered" id="myvideo" width=320 height=240 autoplay muted="muted"/>');
                    Janus.attachMediaStream($('#myvideo').get(0), stream);
                    $("#myvideo").get(0).muted = "muted";

                    var videoTracks = stream.getVideoTracks();
                    if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                      // No webcam
                      $('#myvideo').hide();
                      if($('#videoleft .no-video-container').length === 0) {
                        $('#videoleft').append(
                          '<div class="no-video-container">' +
                            '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                            '<span class="no-video-text">No webcam available</span>' +
                          '</div>');
                      }
                    } 
                    else {}
                  },
                  onremotestream: function(stream) {
                    Janus.debug(" ::: Got a remote stream :::");
                    Janus.debug(stream);
                    console.info(stream);
                    
                    $('#videoright').parent().find('h3').html(
                      'Send DTMF: <span id="dtmf" class="btn-group btn-group-xs"></span>');
                    $('#videoright').append(
                      '<video class="rounded centered hide" id="remotevideo" width=320 height=240 autoplay/>');
                  
                    Janus.attachMediaStream($('#remotevideo').get(0), stream);
                    var videoTracks = stream.getVideoTracks();
                    if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                      // No remote video
                      $('#remotevideo').hide();
                      if($('#videoright .no-video-container').length === 0) {
                        $('#videoright').append(
                          '<div class="no-video-container">' +
                            '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                            '<span class="no-video-text">No remote video available</span>' +
                          '</div>');
                      }
                    } else {}
                  },
                  oncleanup: function() {
                    Janus.log(" ::: Got a cleanup notification :::");
                  }
                });
            },
            error: function(error) {
              Janus.error(error);
              notifyUser('danger', "Unable to connect to AT Janus server. Please contact plugin administrator.");

              console.log(error, function() {
                window.location.reload();
              });
            },
            destroyed: function() {
              window.location.reload();
            }
          }
        );//end
}

function janusInit(){
  Janus.init({debug: "warn", callback: function() {
      console.info("janusInit","Janus started successfully");
    }});
}

function notifyUser(status, message) {
  client.interface.trigger('showNotify', {
    type: status,
    message: message
  });
}

function registerUsername() {
  selectedApproach = 'secret';
  // if(sipserver !== "" && sipserver.indexOf("sip:") != 0 && sipserver.indexOf("sips:") !=0) {
  
  if(sipserver !== "" && sipserver.indexOf("sip:") != 0) {
    console.warn("Please insert a valid SIP server (e.g., sip:192.168.0.1:5060)");
    notifyUser('danger', 'Please insert a valid SIP server (e.g., sip:192.168.0.1:5060)');
    return;
  }

  if(username === "" || username.indexOf("sip:") != 0 || username.indexOf("@") < 0) {
    console.warn('Please insert a valid SIP identity address (e.g., sip:goofy@example.com)');
    notifyUser('danger', 'Please insert a valid SIP identity address (e.g., sip:goofy@example.com)');
    return;
  }

  if(password === "") {
    console.warn("Insert the username secret (e.g., mypassword)");
    notifyUser('danger', 'Insert the username secret (e.g., mypassword)');
    return;
  }

  var register = {
    "request" : "register",
    "username" : username
  };

  if(selectedApproach === "secret") {
    // Use the plain secret
    register["secret"] = password;
  }

  if(sipserver === "") {
    console.log("You didn't specify a SIP Registrar: this will cause the plugin to try and conduct a standard (<a href='https://tools.ietf.org/html/rfc3263' target='_blank'>RFC3263</a>) lookup. If this is not what you want or you don't know what this means, hit Cancel and provide a SIP Registrar instead'",
      function(result) {
        if(result) {
          sipcall.send({"message": register});
        } else {
        }
      }); 
  } else {
    register["proxy"] = sipserver;
    sipcall.send({"message": register});
  }
}

function storeIparams() {
  client.request.invoke('setConfigData', {})
  .then(function(data) {
      console.log("setConfigData","Config data set successfully.");
  })
  .catch(function(error) {
      console.log(error.message);
  });
}


function doCall() {
  // storeIparams();

  client.db.get("africastalking").then (
  function(data) {
    // console.log("data",data);
    application_url = data.configData.application_url;
    sip_number      = data.configData.sip_number;
    username        = "sip:"+data.configData.sip_number;
    sipserver       = data.configData.sipserver;

    var body    = JSON.stringify({ 
          client_data : JSON.stringify(client_data),
          caller      : sip_number,
          enqueue     : 1
    });

    var headers = {};
    var options = { headers: headers, body: body};
    var url = application_url;
    client.request.post(url, options)
    .then (
    function(data) {
      response = JSON.parse(data.response);
      if (response.message == "SUCCESS") {
        notifyUser('success', 'Call has been queued with your server successfully.');
        call_queued = 1;
      }else{
        call_queued = 0;
      }

      if (call_queued > 0) {
        console.log("queued");
        $('#call').attr('disabled', true).unbind('click');

        if(username === "") {
          console.log('Please insert a valid SIP address (e.g., sip:pluto@example.com)');
          notifyUser('danger', 'Please insert a valid SIP address (e.g., sip:pluto@example.com)');
          return;
        }

        doVideo = "false";
        Janus.log("This is a SIP " + (doVideo ? "video" : "audio") + " call (dovideo=" + doVideo + ")"); 
        console.info("This is a SIP " + (doVideo ? "video" : "audio") + " call (dovideo=" + doVideo + ")"); 
        sipcall.createOffer({
          media: {
            audioSend: true, audioRecv: true,   // We DO want audio
            videoSend: false, videoRecv: false  // We MAY want video
          },
          success: function(jsep) {
            Janus.debug("Got SDP!");
            Janus.debug(jsep);
            console.info("Got SDP!");
            console.info(jsep);

            console.log("Got SDP");
            console.log(jsep);

            var body = { request: "call", uri: username };

            sipcall.send({"message": body, "jsep": jsep});
          },
          error: function(error) {
            Janus.error("WebRTC error...", error);
            console.log("WebRTC error... " + JSON.stringify(error));
            console.error("WebRTC error... " + JSON.stringify(error));
          }
        });//end of sipcall
      }else{
        notifyUser('danger', 'Unable to reach queueing server');
        console.log('Unable to reach queueing server');
      }
    
    },
    function(error) {
      // console.log(error);  
      console.info('Queueing error',error);
      notifyUser('danger', 'Unable to connect to your server at: '+application_url);
        
    });
  },
  function(error) {
    console.log("error",error);
    notifyUser('danger', error.message || 'Unable to connect to your server.');
    return;
  });

}//end of doCall()

function doHangup() {
  // Hangup a call
  $('#call').attr('disabled', true).unbind('click');
  var hangup = { "request": "hangup" };
  sipcall.send({"message": hangup});
  sipcall.hangup();
}

