// detect server from URL
var hostArray = window.location.host.split(':');
var serverLoc = 'ws://' + hostArray[0] + ':1337/'
var socket = new WebSocket(serverLoc); 

var shareVideo = document.getElementById('shareVideo');
var shareVideoActive = false;
var remoteVideo = document.getElementById('remoteVideo');
var remoteVideoActive = false;
var localvid = document.getElementById('localVideo');
var localStream = null;
var shuttingDown = false;
var mediaFlowing = false;
var removeVP8Codec = document.getElementById('h264').checked;
var pconns = {};
var mediaConstraints = {'mandatory': {
                        'OfferToReceiveAudio':true, 
                        'OfferToReceiveVideo':true}};

function handleRadioClick(myRadio) {
  if (myRadio.value == 'h264') {
    removeVP8Codec = true;
  } else {
    removeVP8Codec = false;
  }
}

window.onload = function() {
  startMedia();
}

function startMedia() {
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia || navigator.msGetUserMedia;
  window.URL = window.URL || window.webkitURL;
  navigator.getUserMedia({video: true, audio: true}, successCallback, errorCallback);
}

function stopMedia() {
  if (localvid.mozSrcObject) {
    localvid.mozSrcObject.stop();
    localvid.src = null;
  } else {
    localvid.src = "";
    if (localStream)
      localStream.stop();
  }

  if (mediaFlowing && !shuttingDown) {
    if(pconns[1]) {
      pconns[1].removeStream(localStream);
      pconns[1].createOffer(setLocalDescAndSendMessagePC1Offer, errorCallback, mediaConstraints);
    }
  }
  localStream = null;
}

function successCallback(stream) {
  localStream = stream;
  playLocalvideo();

  if (mediaFlowing) {
    if (pconns[1]) {
      shuttingDown = false;
      pconns[1].addStream(localStream);
      pconns[1].createOffer(setLocalDescAndSendMessagePC1Offer, errorCallback, mediaConstraints); 
    }
  }
}

function playLocalvideo() {
  if (localStream) {
    if (localvid.mozSrcObject) {
      localvid.mozSrcObject = localStream;
      localvid.play();
    } else {
      try {
        localvid.src = window.URL.createObjectURL(localStream);
        localvid.play();
      } catch(e) {
        console.log("Error setting video src: ", e); 
      }   
    }
  }   
}

function errorCallback(error) {
  console.error('An error occurred: [CODE ' + error.code + ']');
  return;
}

function pause() {
  shareVideo.pause();
  remoteVideo.pause();
}

function play() {
  shareVideo.play();
  remoteVideo.play();
}

// stop the connection on button click 
function disconnect() {
  shuttingDown = true;
  console.log("disconnect()");    
  socket.send(JSON.stringify({
                "pc": 0,
                "messageType": "bye"
             }));
  stop();
}

function stop() {
  console.log("stop()");    

  stopMedia();

  if (pconns[0] != null ) {
    pconns[0].close();
    pconns[0] = null;
  }
  if (pconns[1] != null ) {
    pconns[1].close();
    pconns[1] = null;
  }
  shareVideo.src = ""; 
  remoteVideo.src = ""; 
  localvid.src = "";
  mediaFlowing = false;        
  shareVideoActive = false;
  remoteVideoActive = false;
}

// If you want to use H.264 then remove other stuff form the SDP
function removeVP8(sdp) {
  //updated_sdp = sdp.replace("m=video 1 RTP/SAVPF 100 116 117 96 120 121\r\n","m=video 1 RTP/SAVPF 120 121\r\n");
  //updated_sdp = sdp.replace("m=video 1 RTP/SAVPF 100 116 117 96 120 121\r\n","m=video 1 RTP/SAVPF 120\r\n");
  updated_sdp = sdp.replace("m=video 9 RTP/SAVPF 100 116 117 120 96\r\n","m=video 9 RTP/SAVPF 120\r\n");
  updated_sdp = updated_sdp.replace("","");
  updated_sdp = updated_sdp.replace("a=rtpmap:100 VP8/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=rtpmap:120 H264/90000\r\n","a=rtpmap:120 H264/90000\r\na=fmtp:120 profile-level-id=42e01f;packetization-mode=1\r\n");

  updated_sdp = updated_sdp.replace("a=rtcp-fb:100 nack\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:100 nack pli\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:100 ccm fir\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:100 goog-remb\r\n","");
  updated_sdp = updated_sdp.replace("a=rtpmap:116 red/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=rtpmap:117 ulpfec/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=rtpmap:96 rtx/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=fmtp:96 apt=100\r\n","");

  updated_sdp = updated_sdp.replace("a=rtpmap:121 CAST1/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:121 ccm fir\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:121 nack\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:121 nack pli\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:121 goog-remb\r\n","");

  return updated_sdp;
}

function setLocalDescSuccess() {
  console.log("setLocalDescSuccess success");
}

// Two peerconnections are used to have Firefox compatability, this is
// because Chrome can do share and video using one PeerConnection but FF needs two.
function setLocalDescAndSendMessagePC0Answer(sessionDescription) {
 pconns[0].setLocalDescription(sessionDescription, setLocalDescSuccess, errorCallback);
 console.log("Sending: SDP");
 console.log(sessionDescription);

 socket.send(JSON.stringify({
                 "pc": 0,
                 "messageType": "answer",
                 "peerDescription": sessionDescription
            }));
}

// send SDP over web socket
function setLocalDescAndSendMessagePC1Answer(sessionDescription) {

  if (removeVP8Codec) {
    // Remove VP8 from offer every time, disabled for now
    //sessionDescription.sdp = removeVP8(sessionDescription.sdp); 
    pconns[1].setLocalDescription(sessionDescription, setLocalDescSuccess, errorCallback);
  } else {
    pconns[1].setLocalDescription(sessionDescription, setLocalDescSuccess, errorCallback);
  }
  console.log("Sending: SDP");
  console.log(sessionDescription);

  socket.send(JSON.stringify({
                  "pc": 1,
                  "messageType": "answer",
                  "peerDescription": sessionDescription
             }));
}

function setLocalDescAndSendMessagePC1Offer(sessionDescription) {
  pconns[1].setLocalDescription(sessionDescription , setLocalDescSuccess, errorCallback);
  console.log("Sending: SDP");
  console.log(sessionDescription);
  socket.send(JSON.stringify({
                  "pc": 1,
                  "messageType": "offer",
                  "peerDescription": sessionDescription
            }));
}

function addCandidateSuccess() {
  console.log("addCandidate success");
} 

socket.addEventListener("message", onWebSocketMessage, false);

// process messages from web socket 
function onWebSocketMessage(evt) {
  var message = JSON.parse(evt.data);
  var pcID = message.pc;

  if(message.messageType === "offer") {
    console.log("Received offer...")
    if (!pconns[pcID]) {
      createPeerConnection(pcID);
    }

    mediaFlowing = true;
    console.log('Creating remote session description...' );
   
    var remoteDescription = message.peerDescription; 

    if (removeVP8Codec) {
      console.log("offer before manipulation: " + remoteDescription.sdp);
      // Remove VP8 from offer every time
      remoteDescription.sdp = removeVP8(remoteDescription.sdp);
      console.log("offer after manipulation: " + remoteDescription.sdp);
    }      

    var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
    pconns[pcID].setRemoteDescription(new RTCSessionDescription(remoteDescription), function() {
      console.log('Sending answer...');
      if (pcID == 0)
        pconns[0].createAnswer(setLocalDescAndSendMessagePC0Answer, errorCallback, mediaConstraints);
      else
        pconns[1].createAnswer(setLocalDescAndSendMessagePC1Answer, errorCallback, mediaConstraints);

    }, errorCallback);  

  } else if (message.messageType === "answer" && mediaFlowing) {
    var remoteDescription = message.peerDescription;
    console.log(remoteDescription);
    console.log('Received answer...');
    console.log('Setting remote session description...' );
    var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
    pconns[pcID].setRemoteDescription(new RTCSessionDescription(remoteDescription));

  } else if (message.messageType === "iceCandidate" && mediaFlowing) {
    console.log('Received ICE candidate...');
    var RTCIceCandidate = window.mozRTCIceCandidate || window.webkitRTCIceCandidate || window.RTCIceCandidate;
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.candidate.sdpMLineIndex, sdpMid:message.candidate.sdpMid, candidate:message.candidate.candidate});
    pconns[pcID].addIceCandidate(candidate, addCandidateSuccess, errorCallback);

  } else if (message.messageType === 'bye' && mediaFlowing) {
    console.log("Received bye");
    shuttingDown = true;
    stop();

  } else if (message.messageType === "publish" ) {
    console.log("Received publish");

    if (!localStream) {
      startMedia();
    }
    
    // automatically join
    socket.send(JSON.stringify({
                "pc": 0,
                "messageType": "join"
               }));

  }
}

function createPeerConnection(pcID) {
  console.log("Creating peer connection");
  RTCPeerConnection = window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
  var pc_config = {"iceServers":[]};
  try {
    pconns[pcID] = new RTCPeerConnection(pc_config);
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
  }

  // send any ice candidates to the other peer
  pconns[pcID].onicecandidate = function (event) {
    if (event.candidate) {
      console.log('Sending ICE candidate...');
      console.log(event.candidate);
      socket.send(JSON.stringify({
                   "pc": pcID,
                   "messageType": "iceCandidate",
                   "candidate": event.candidate 
                  }));   
    } else {
      console.log("End of candidates");
    }
  };
  
  if (pcID==1 && localStream)
  { 
    pconns[1].addStream(localStream); 
  }
  pconns[pcID].addEventListener("addstream", onRemoteStreamAdded, false);
  pconns[pcID].addEventListener("removestream", onRemoteStreamRemoved, false);

  function onRemoteStreamAdded(event) {
    console.log("Added remote stream");

    if (!shareVideoActive) {
      shareVideo.src = window.URL.createObjectURL(event.stream);
      shareVideo.play();
      shareVideoActive = true;
      return;
    }

    if (!remoteVideoActive) {
      remoteVideo.src = window.URL.createObjectURL(event.stream);
      remoteVideo.play();
      remoteVideoActive = true;
      if (localStream) 
       playLocalvideo(); 
    }
  }

  function onRemoteStreamRemoved(event) {
    console.log("Remove remote stream");
    shareVideo.src = "";
    remoteVideo.src = "";
  }
}