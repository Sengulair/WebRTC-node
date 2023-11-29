const WebSocket = require('ws');
const { RTCPeerConnection } = require('wrtc');

module.exports = {
  createRTCPeerConnection: () => {
    const config = {
      iceServers: [
        {
          urls: 'turn:relay1.expressturn.com:3478',
          username: 'ef18IC3W3OAFOU3ZW1',
          credential: 'ZBFMwQhMIXk6DROS',
          credentialType: 'password'
        }
      ]
    };
    
    const pc = new RTCPeerConnection(config);
    return pc;
  },
  createWSMessaging: (pc, initOffer = false) => {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.on('open', function open() {
      console.log('signaling connected');
      if (initOffer) {
        createOffer();
      }
    });
    
    const handleOffer = async offer => {
      console.log('handleOffer', offer);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', answer: pc.localDescription }));
    };
    
    const handleCandidate = async candidate => {
      console.log('handleCandidate', candidate);
      await pc.addIceCandidate(candidate);
    };
    
    const handleAnswer = async answer => {
      console.log('handleAnswer', answer);
      await pc.setRemoteDescription(answer);
    };
    
    ws.on('message', async (data) => {
      const message = JSON.parse(data);
    
      switch (message.type) {
        case 'offer':
          handleOffer(message.offer);
          break;
        case 'answer':
          handleAnswer(message.answer);
          break;
        case 'candidate':
          handleCandidate(message.candidate);
          break;
        default:
          console.error('Unknown message type:', message.type);
          break;
      }
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    function createOffer() {
      pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
      }).then(() => {
        ws.send(JSON.stringify({ type: 'offer', offer: pc.localDescription }));
      }).catch(handleError);
    }
    
    function handleError(err) {
      console.error(err);
    }
  }
}