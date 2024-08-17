// config.js
require('dotenv').config();

const serverUrl = process.env.SERVER_URL;
const serverPort = process.env.SERVER_PORT;

module.exports = {
  listenIp: '0.0.0.0', //모든 ip로 부터 입장을 허용
  listenPort: serverPort,
  //sslCrt: '/usr/local/etc/ssl/server.crt',
  //sslKey: '/usr/local/etc/ssl/server.key',
  mediasoup: {
    // Worker settings
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
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
                'x-google-start-bitrate': 1000
              }
          },
        ]
    },
    // WebRtcTransport settings
    webRtcTransport: {
      listenIps: [
        {
          ip: serverUrl, // 어느 경로로 입장을 허가할것인가
          announcedIp: null,
        }
      ],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
    }
  }
};
