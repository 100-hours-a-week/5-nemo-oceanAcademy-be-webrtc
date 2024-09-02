// config.js
require('dotenv').config();

const serverUrl = process.env.SERVER_URL;
const serverPort = parseInt(process.env.SERVER_PORT, 10);;
const sslCrt = process.env.SSL_CERTIFICATE;
const sslKey = process.env.SSL_KEY;
const sentryDSN = process.env.SENTRY_DSN;

module.exports = {
  listenIp: '0.0.0.0', //모든 ip로 부터 입장을 허용
  listenPort: serverPort,
  sslCrt: sslCrt, 
  sslKey: sslKey,
  sentryDSN: sentryDSN,

  mediasoup: {
    // Worker settings
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 60000,
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ],
    },
    // Router settings
    router: {
      mediaCodecs:
        [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2
          },
          {
            kind: 'video',
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters:
              {
                //'x-google-start-bitrate': 1000
                'packetization-mode': 1,
                'profile-level-id': '42e01f',
                'x-google-start-bitrate': 1500,
                'x-google-max-bitrate': 5000,
                'x-google-min-bitrate': 2000,
              }
          },
        ]
    },
    // WebRtcTransport settings
    webRtcTransport: {
      listenIps: [
        {
          ip: '0.0.0.0', // 입장이 허용된 ip
          announcedIp: serverUrl,// 어느 경로로 입장을 허가할것인가
        }
      ],
      maxIncomingBitrate: 2000000,//1500000,
      initialAvailableOutgoingBitrate: 1500000,//1000000,
    }
  }
};
