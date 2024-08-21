/*
전체 실행 흐름
서버 실행: runExpressApp(), runWebServer(), runSocketServer(), runMediasoupWorker()가 차례로 실행됩니다.
Express 서버 설정: 기본적인 웹 서버와 오류 처리 미들웨어를 설정합니다.
HTTPS 서버 설정: SSL 인증서로 보호된 HTTPS 서버를 실행합니다.
WebSocket 서버 설정: 실시간 통신을 위한 WebSocket 서버를 실행합니다.
Mediasoup 워커 생성: WebRTC 미디어 처리를 위한 워커를 생성합니다.
WebRTC 트랜스포트 생성: WebRTC 전송을 위한 트랜스포트를 설정하고 클라이언트의 요청에 따라 처리합니다.
미디어 소비자 생성: 클라이언트의 요청에 따라 미디어 소비자를 생성하고 프로듀서와 연결합니다.
이 코드는 WebRTC를 통해 실시간 미디어 스트리밍 애플리케이션을 구축하는 데 필요한 주요 기능을 모두 포함하고 있습니다.
각 단계는 서버의 구성 요소를 설정하고 클라이언트와의 통신을 관리합니다.
*/

const mediasoup = require('mediasoup');
const fs = require('fs');
const https = require('https');
const express = require('express');
const socketIO = require('socket.io');
const config = require('./config');

// Global variables
let worker;
let webServer;
let socketServer;
let expressApp;
let producer;
let consumer;
let producerTransport;
let consumerTransport;
let mediasoupRouter; 

const Producers = {
  WEBCAM_VIDEO: 'webcamVideo',
  WEBCAM_AUDIO: 'webcamAudio',
  SCREEN_SHARE_VIDEO: 'screenShareVideo',
  SCREEN_SHARE_AUDIO: 'screenShareAudio'
}

const roomProducers = {}; // 각 방에 대한 프로듀서 관리
const roomConsumers = {}; // 각 방에 대한 소비자 관리
const roomProducerTransports = {}; // 각 방에 대한 프로듀서 트랜스포트 관리
const roomConsumerTransports = {}; // 각 방에 대한 소비자 트랜스포트 관리;

(async () => {
  try {
    await runExpressApp();
    await runWebServer();
    await runSocketServer();
    await runMediasoupWorker();
  } catch (err) {
    console.error(err);
  }
})();

/*
1. runExpressApp()
목적: Express 애플리케이션을 설정하고 기본적인 오류 처리 미들웨어를 설정합니다.
주요 작업:
- JSON 요청 본문을 처리하기 위해 express.json() 미들웨어를 사용.
- 정적 파일을 제공하기 위해 express.static() 미들웨어를 사용.
- 오류 처리 미들웨어를 추가하여 발생하는 오류를 클라이언트에 전달.
*/
async function runExpressApp() {
  expressApp = express();
  expressApp.use(express.json());
  expressApp.use(express.static(__dirname));

  expressApp.use((error, req, res, next) => {
    if (error) {
      console.warn('Express app error,', error.message);

      error.status = error.status || (error.name === 'TypeError' ? 400 : 500);

      res.statusMessage = error.message;
      res.status(error.status).send(String(error));
    } else {
      next();
    }
  });
}

/*
2. runWebServer()
목적: HTTPS 서버를 설정하고 실행합니다.
주요 작업:
SSL 인증서 파일을 읽어와서 https.createServer()로 HTTPS 서버를 생성.
서버가 포트 3000에서 요청을 수신하도록 설정 (listenPort와 listenIp은 config에서 가져옵니다).
서버가 실행되면 콘솔에 서버가 실행되고 있는 IP 주소와 포트를 출력합니다.
*/
async function runWebServer() {
  const { sslKey, sslCrt } = config;
  if (!fs.existsSync(sslKey) || !fs.existsSync(sslCrt)) {
    console.error('SSL files are not found. check your config.js file');
    process.exit(0);
  }
  const tls = {
    cert: fs.readFileSync(sslCrt),
    key: fs.readFileSync(sslKey),
  };
  webServer = https.createServer(tls, expressApp);
  webServer.on('error', (err) => {
    console.error('starting web server failed:', err.message);
  });

  await new Promise((resolve) => {
    const { listenIp, listenPort } = config;
    webServer.listen(listenPort, listenIp, () => {
      const listenIps = config.mediasoup.webRtcTransport.listenIps[0];
      const ip = listenIps.announcedIp || listenIps.ip;
      console.log('server is running');
      console.log(`open https://${ip}:${listenPort} in your web browser`);
      resolve();
    });
  });
}

/*
3. runSocketServer()
목적: WebSocket 서버를 설정하여 클라이언트와 실시간 통신을 처리합니다.
주요 작업:
socketIO를 사용하여 WebSocket 서버를 생성.
클라이언트가 연결되면 newProducer 이벤트를 통해 기존의 프로듀서가 있음을 알립니다.
클라이언트의 다양한 요청을 처리합니다. 여기에는 프로듀서 및 컨슈머 트랜스포트를 생성하고 연결하는 작업이 포함됩니다.
produce와 consume 이벤트를 통해 미디어 스트림의 송출 및 수신을 처리합니다.
*/
async function runSocketServer() {
  socketServer = socketIO(webServer, {
    serveClient: false,
    path: '/server',
    log: false,
  });

  socketServer.on('connection', (socket) => {
    console.log('client connected');


    // teacher가 socket을 시작할 때 producer 저장을 위해 초기화를 진행합니다.
    socket.on('startRoom', (roomId) => {
      socket.join(roomId);
      console.log(`User started room: ${roomId}`);

      // roomId의 producer들을 저장하기 위해 객체를 만들어 둠
      roomProducers[roomId] = {};
      roomConsumers[roomId] = {}; 
      roomProducerTransports[roomId] = {}; 
      roomConsumerTransports[roomId] = {}; 
      
      // [x] 다 초기화 하기
    });


    // inform the client about existence of producer
    //클라이언트가 연결되면 현재 서버에 존재하는 프로듀서가 있으면 이를 클라이언트에 알립니다.
    //socket.emit('newProducer')는 클라이언트에게 newProducer 이벤트를 발생시킵니다.
    // 클라이언트로부터 방 참가 요청 수신
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
      
      // 방에 프로듀서가 존재하는 경우 클라이언트에게 알림
      // [x] 프로듀서 정보 4개를 다 알려주는 방식으로 변경 필요,  'newProducer'말고 다른 명령어 만들기
      // NOTE 정보 요청은 클라리언트에서 따로 request를 보내는 형식으로 변경
    });

    // NOTE 현재 room에 있는 producer의 정보를 return 함
    // 잘 return 하고 있음...
    socket.on('getProducers',(roomId, callback)=>{
      callback(roomProducers[roomId]);
    } )

    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);  // 방 떠나기
      console.log(`User left room: ${roomId}`);
    });
  

    socket.on('disconnect', () => {
      console.log('client disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('client connection error', err);
    });

    ////////////////////////////////////////////////////
    //클라이언트가 getRouterRtpCapabilities 이벤트를 발생시키면, mediasoupRouter의 RTP 능력을 클라이언트에 반환합니다.
    socket.on('getRouterRtpCapabilities', (data, callback) => {
      callback(mediasoupRouter.rtpCapabilities);
    });

    //클라이언트가 createProducerTransport 이벤트를 발생시키면
    //새로운 WebRTC 트랜스포트를 생성하고, producerTransport를 설정합니다.
    // [ ] roomId당 하나의 transport만 저장하고 있음
    // [ ] producerKind도 받아야함
    socket.on('createProducerTransport', async (data, callback) => {
      try {
        const { roomId, producerKind } = data;
        const { transport, params } = await createWebRtcTransport();
        roomProducerTransports[roomId][producerKind] = transport;
        callback(params);
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    });

    //클라이언트가 createConsumerTransport 이벤트를 발생시키면 새로운 WebRTC 트랜스포트를 생성하고, 
    //consumerTransport를 설정합니다.
    socket.on('createConsumerTransport', async (data, callback) => {
      try {
        const { roomId, producerKind } = data;
        const { transport, params } = await createWebRtcTransport();
        roomConsumerTransports[roomId][producerKind] = transport;
        callback(params);
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    });

    //클라이언트가 connectProducerTransport 이벤트를 발생시키면, 
    //producerTransport에 클라이언트의 DTLS 파라미터를 사용하여 연결합니다.
    socket.on('connectProducerTransport', async (data, callback) => {
      const { roomId, producerKind, dtlsParameters } = data;
      await roomProducerTransports[roomId][producerKind].connect({ dtlsParameters: data.dtlsParameters });
      callback();
    });

    //클라이언트가 connectConsumerTransport 이벤트를 발생시키면, 
    //consumerTransport에 클라이언트의 DTLS 파라미터를 사용하여 연결합니다.
    socket.on('connectConsumerTransport', async (data, callback) => {
      const { roomId, dtlsParameters, producerKind} = data;
      await roomConsumerTransports[roomId][producerKind].connect({ dtlsParameters: data.dtlsParameters });
      callback();
    });

    /*
    클라이언트가 produce 이벤트를 발생시키면, producerTransport를 통해 미디어 프로듀서를 생성합니다.
    생성된 프로듀서의 ID를 클라이언트에 반환합니다.
    새로운 프로듀서가 생성되었음을 모든 다른 클라이언트에게 알립니다 (socket.broadcast.emit('newProducer')).
    */
    socket.on('produce', async (data, callback) => {
      // [x] 어떤 영상/음성 보내는지 추가로 전송필요 -> producerKind를 입력받기
      const { roomId, kind, rtpParameters, producerKind } = data;
      producer = await roomProducerTransports[roomId][producerKind].produce({ kind, rtpParameters });
      
      // [x] 저장 로직 변경 필요
      roomProducers[roomId][producerKind] = producer;
      callback({ id: producer.id });

      // 방에 있는 다른 클라이언트들에게 새로운 프로듀서가 있음을 알림
      // [x] 'newProducer' 로, roomId랑 producerKind를 알려줘야 함
      // NOTE : 저장 로직을 변경해서 consumer 생성 로직도 변경해야함
      socket.to(roomId).emit('newProducer', { roomId, producerKind });
    });

    /*
    클라이언트가 consume 이벤트를 발생시키면, createConsumer 함수를 사용하여 미디어 소비자를 생성하고, 생성된 소비자의 정보를 클라이언트에 반환합니다.
    */
    socket.on('consume', async (data, callback) => {
      const { roomId, producerKind, rtpCapabilities } = data;
      const consumer = await createConsumer(roomId, producerKind, rtpCapabilities);
      callback(consumer);
    });

    //클라이언트가 resume 이벤트를 발생시키면, 일시 중지된 소비자를 재개하고 콜백을 호출합니다.
    socket.on('resume', async (data, callback) => {
      const { roomId, producerKind } = data;
      // [x] consumer 저장 로직 수정 필요
      // NOTE : client 당 consumer를 저장하는 로직이 필요할 수도 있음
      await roomConsumers[roomId][producerKind].resume();
      callback();
    });

    socket.on('newProducer', async ({ roomId, producerId, producerKind }) => {
      console.log('Received Producer ID:', producerId); // 로그 추가
      console.log('Received Producer Kind:', producerKind); // 로그 추가
      socket.to(roomId).emit('newProducer', { roomId, producerId, producerKind });
    });
  
  });
}

/*
4. runMediasoupWorker()
목적: mediasoup 워커를 생성하여 WebRTC 미디어 처리 작업을 수행합니다.
주요 작업:
mediasoup.createWorker()를 사용하여 워커를 생성하고, worker.on('died') 이벤트를 통해 워커가 비정상 종료되면 애플리케이션을 종료합니다.
워커를 사용하여 mediasoupRouter를 생성합니다.
*/
async function runMediasoupWorker() {
  worker = await mediasoup.createWorker({
    logLevel: config.mediasoup.worker.logLevel,
    logTags: config.mediasoup.worker.logTags,
    rtcMinPort: config.mediasoup.worker.rtcMinPort,
    rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });

  const mediaCodecs = config.mediasoup.router.mediaCodecs;
  mediasoupRouter = await worker.createRouter({ mediaCodecs });
}

/*
5. createWebRtcTransport()
목적: WebRTC 전송 트랜스포트를 생성합니다.
주요 작업:
mediasoupRouter.createWebRtcTransport()를 사용하여 트랜스포트를 생성하고, 최대 수신 비트레이트를 설정합니다 (옵션인 경우).
생성된 트랜스포트의 관련 파라미터를 반환합니다.
*/
async function createWebRtcTransport() {
  const {
    maxIncomingBitrate,
    initialAvailableOutgoingBitrate
  } = config.mediasoup.webRtcTransport;

  const transport = await mediasoupRouter.createWebRtcTransport({
    listenIps: config.mediasoup.webRtcTransport.listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate,
  });
  if (maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(maxIncomingBitrate);
    } catch (error) {
    }
  }
  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    },
  };
}


/*
6. createConsumer()
목적: 프로듀서의 미디어를 소비할 소비자를 생성합니다.
주요 작업:
mediasoupRouter.canConsume()을 통해 소비할 수 있는지 확인합니다.
consumerTransport.consume()를 사용하여 소비자를 생성하고, 소비자의 유형에 따라 레이어를 설정합니다.
소비자 정보를 반환합니다.
*/
/* 특정 방에 대한 미디어 소비자 생성 함수 */
async function createConsumer(roomId, producerKind, rtpCapabilities) {
  console.log('createConsumer called with:', { roomId, rtpCapabilities });

  // [x] producer 받는 로직 변경하기 
  // [ ] roomId, producerKind -> undefined 
  console.log(roomId, producerKind);
  const producer = roomProducers[roomId][producerKind];
  if (!producer) {
    console.error(`No producer found for roomId: ${roomId}`);
    return;
  }

  console.log('Producer found:', producer);

  const canConsume = mediasoupRouter.canConsume({ producerId: producer.id, rtpCapabilities });
  console.log('Can consume:', canConsume);

  if (!canConsume) {
    console.error(`Cannot consume: Producer ID: ${producer.id}, Room ID: ${roomId}`);
    console.error('RTP Capabilities:', rtpCapabilities);
    return;
  }
  
  try {
    // [ ] video라고 작성되어있는데 audio도 가능한 건지??
    const consumer = await roomConsumerTransports[roomId][producerKind].consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: producer.kind === 'video',
    });
    roomConsumers[roomId][producerKind] = consumer;

    if (consumer.type === 'simulcast') {
      await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
    }

    return {
      producerId: producer.id,
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    };
  } catch (error) {
    console.error('Consume failed', error);
    return;
  }
}
