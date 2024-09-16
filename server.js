const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");
const config = require('./config');
const { sentryDSN } = config;

Sentry.init({
  dsn: sentryDSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

const mediasoup = require('mediasoup');
const fs = require('fs');
const https = require('https');
const express = require('express');
const socketIO = require('socket.io');

// Global variables
let worker;
let webServer;
let socketServer;
let expressApp;
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
let producers ={};
let consumers ={};
let participantCount = {};

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

async function runExpressApp() {
  expressApp = express();
  expressApp.use(express.json());
  expressApp.use(express.static(__dirname));
  Sentry.setupExpressErrorHandler(expressApp);
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
    Sentry.captureException(err); 
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

async function runSocketServer() {
  socketServer = socketIO(webServer, {
    serveClient: false,
    path: '/server',
    log: false,
  });

  socketServer.on('connection', (socket) => {


    socket.on('startRoom', (roomId) => {
      socket.join(roomId);
      console.log(`User started room: ${roomId}`);

      roomProducers[roomId] = {};
      roomConsumers[roomId] = {}; 
      roomProducerTransports[roomId] = {}; 
      roomConsumerTransports[roomId] = {}; 
      participantCount[roomId] = 0;
      initializeProducer(socket.id, roomId);
    });

    // 클라이언트로부터 방 참가 요청 수신
    socket.on('joinRoom', (roomId) => {
      // if(!participantCount[roomId]){
      //   console.log("no start room");
      //   return;
      // }
      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
      initializeConsumer(socket.id, roomId);
      if(participantCount[roomId]){
        participantCount[roomId] += 1;
        socket.to(roomId).emit('participantCountUpdate', participantCount[roomId]);
      }
    });

    // NOTE 현재 room에 있는 producer의 정보를 return 함
    socket.on('getProducers',(roomId, callback)=>{
      callback(roomProducers[roomId]);
    } )

    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);  // 방 떠나기
      console.log(`User left room: ${roomId}`);
    });
  

    socket.on('disconnect', () => {
      let roomId;
      if(consumers[socket.id]){
        const producerKinds = Object.values(Producers); // value를 배열로 가지고 온다.
        for (let producerKind of producerKinds) {
          let transportId;
          let consumerId;

          if (consumers[socket.id]) {
            roomId = consumers[socket.id].roomId;
          } else {
            continue;
          }

          if (consumers[socket.id][producerKind]) {
            transportId=consumers[socket.id][producerKind].transportId;
            consumerId=consumers[socket.id][producerKind].consumerId;
          } 
          
          if (transportId && roomConsumerTransports[roomId] && roomConsumerTransports[roomId][producerKind]) {
            delete roomConsumerTransports[roomId][producerKind][transportId];
          } else {
            continue;
          }
  
          if (consumerId && roomConsumers[roomId] && roomConsumers[roomId][producerKind]) {
            delete roomConsumers[roomId][producerKind][consumerId];
          } else {
            continue;
          }
        }
        delete consumers[socket.id];
        
        if(participantCount[roomId]){
          participantCount[roomId] -= 1;
          socket.to(roomId).emit('participantCountUpdate', participantCount[roomId]);
        }
      }

      if(producers[socket.id]){
        const producerKinds = Object.values(Producers); // value를 배열로 가지고 온다.
        for (let producerKind of producerKinds) {
          let transportId;
          let producerId;

          if (producers[socket.id]) {
            roomId = producers[socket.id].roomId;
          } else {
            continue;
          }

          //teacherLeft 이벤트 emit
          socket.to(roomId).emit('teacherLeft');
          console.log(roomId);

          if (producers[socket.id][producerKind]) {
            transportId=producers[socket.id][producerKind].transportId;
            producerId=producers[socket.id][producerKind].producerId;
          } 
          
          if (transportId && roomProducerTransports[roomId] && roomProducerTransports[roomId][producerKind]) {
            delete roomProducerTransports[roomId][producerKind];
          } else {
            continue;
          }
  
          if (producerId && roomProducers[roomId] && roomProducers[roomId][producerKind]) {
            delete roomProducers[roomId][producerKind];
          } else {
            continue;
          }
        }
        delete producers[socket.id];
        delete participantCount[roomId];
        delete roomProducers[roomId];
        delete roomProducerTransports[roomId];
        //TODO 방에 참여중인 컨슈머 모두 disconnect
      }
      console.log(`client disconnected: ${roomId}`);
      socket.leave(roomId);
    });

    socketServer.on('connect_error', (err) => {
      Sentry.captureException(err);
      console.error('client connection error', err);
    });

    //클라이언트가 getRouterRtpCapabilities 이벤트를 발생시키면, mediasoupRouter의 RTP 능력을 클라이언트에 반환합니다.
    socket.on('getRouterRtpCapabilities', (data, callback) => {
      callback(mediasoupRouter.rtpCapabilities);
    });

    //클라이언트가 createProducerTransport 이벤트를 발생시키면
    //새로운 WebRTC 트랜스포트를 생성하고, producerTransport를 설정합니다.
    socket.on('createProducerTransport', async (data, callback) => {
      try {
        const { roomId, producerKind } = data;
        const { transport, params } = await createWebRtcTransport();
        if (!roomProducerTransports[roomId]) {
          roomConsumerTransports[roomId] = {};
        }
        if (!roomProducerTransports[roomId][producerKind]) {
          roomConsumerTransports[roomId][producerKind] = {};
        }
      
        roomProducerTransports[roomId][producerKind] = transport;
        producers[socket.id][producerKind].transportId = transport.id;
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
        if (!roomConsumerTransports[roomId]) {
          roomConsumerTransports[roomId] = {};
        }
      
        if (!roomConsumerTransports[roomId][producerKind]) {
          roomConsumerTransports[roomId][producerKind] = {};
        }
      
        roomConsumerTransports[roomId][producerKind][transport.id]=transport;
        consumers[socket.id][producerKind].transportId = transport.id;
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
      const { roomId, producerKind, transportId, dtlsParameters} = data;
      await roomConsumerTransports[roomId][producerKind][transportId].connect({ dtlsParameters: data.dtlsParameters });
      callback();
    });

    socket.on('produce', async (data, callback) => {
      // [x] 어떤 영상/음성 보내는지 추가로 전송필요 -> producerKind를 입력받기
      const { roomId, kind, rtpParameters, producerKind } = data;
      const producer = await roomProducerTransports[roomId][producerKind].produce({ kind, rtpParameters });
      producers[socket.id][producerKind].producerId = producer.id;
      roomProducers[roomId][producerKind] = producer;
      callback({ id: producer.id });

      socket.to(roomId).emit('newProducer', { roomId, producerKind });
    });

    socket.on('consume', async (data, callback) => {
      const { roomId, producerKind,transportId, rtpCapabilities } = data;
      const consumer = await createConsumer(roomId, producerKind,transportId, rtpCapabilities);
      consumers[socket.id][producerKind].consumerId = consumer.id;
      callback(consumer);
    });

    //클라이언트가 resume 이벤트를 발생시키면, 일시 중지된 소비자를 재개하고 콜백을 호출합니다.
    socket.on('resume', async (data, callback) => {
      const { roomId, producerKind, consumerId } = data;
      await roomConsumers[roomId][producerKind][consumerId].resume();
      callback();
    });

    socket.on('newProducer', async ({ roomId, producerId, producerKind }) => {
      socket.to(roomId).emit('newProducer', { roomId, producerId, producerKind });
    });
  
  });
}

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


async function createConsumer(roomId, producerKind,transportId, rtpCapabilities) {
  const producer = roomProducers[roomId][producerKind];
  if (!producer) {
    console.error(`No producer found for roomId: ${roomId}`);
    return;
  }
  const canConsume = mediasoupRouter.canConsume({ producerId: producer.id, rtpCapabilities });

  if (!canConsume) {
    console.error(`Cannot consume: Producer ID: ${producer.id}, Room ID: ${roomId}`);
    console.error('RTP Capabilities:', rtpCapabilities);
    return;
  }
  
  try {
    const consumer = await roomConsumerTransports[roomId][producerKind][transportId].consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: producer.kind === 'video',
    });

    if (consumer.type === 'simulcast' && producer.kind === 'video') {
      await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
    }
    if (!roomConsumers[roomId]) {
      roomConsumers[roomId] = {};
    }
  
    if (!roomConsumers[roomId][producerKind]) {
      roomConsumers[roomId][producerKind] = {};
    }
  
    roomConsumers[roomId][producerKind][consumer.id]=consumer;

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

function initializeConsumer(socketId, roomId) {
  consumers[socketId] = {
      roomId: roomId,
      [Producers.WEBCAM_VIDEO]: {
          transportId: null,
          consumerId: null
      },
      [Producers.WEBCAM_AUDIO]: {
          transportId: null,
          consumerId: null
      },
      [Producers.SCREEN_SHARE_VIDEO]: {
          transportId: null,
          consumerId: null
      },
      [Producers.SCREEN_SHARE_AUDIO]: {
          transportId: null,
          consumerId: null
      }
  };
}

function initializeProducer(socketId, roomId) {
  producers[socketId] = {
      roomId: roomId,
      [Producers.WEBCAM_VIDEO]: {
          transportId: null,
          produceId: null
      },
      [Producers.WEBCAM_AUDIO]: {
          transportId: null,
          produceId: null
      },
      [Producers.SCREEN_SHARE_VIDEO]: {
          transportId: null,
          produceId: null
      },
      [Producers.SCREEN_SHARE_AUDIO]: {
          transportId: null,
          produceId: null
      }
  };
}

//동기적으로 발생한 예기치 않은 오류 캐치
//try-catch 블록으로 처리되지 않은 동기적 오류가 발생했을 때 호출
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  Sentry.captureException(err);
  //process.exit(1);  // 필요한 경우 프로세스를 종료
});

//Promise에서 발생한 미처리된 거부 캐치
//이벤트는 Promise에서 처리되지 않은 거부(rejection)가 발생했을 때 호출
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  Sentry.captureException(reason); 
});