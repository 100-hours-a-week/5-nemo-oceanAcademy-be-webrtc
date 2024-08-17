# Mediasoup Sample App

A minimal Client/Server app based on Mediasoup and Socket.io


## Dependencies

* [Mediasoup v3 requirements](https://mediasoup.org/documentation/v3/mediasoup/installation/#requirements)
* Node.js >= v8.6
* [Browserify](http://browserify.org/)


## Run

The server app runs on any supported platform by Mediasoup. The client app runs on a single browser tab.
```
# create and modify the configuration
# make sure you set the proper IP for mediasoup.webRtcTransport.listenIps
cp config.example.js config.js
nano config.js

# install dependencies and build mediasoup
npm install

# create the client bundle and start the server app
npm start
```



----

- 리포: https://github.com/mkhahani/mediasoup-sample-app

- 설명: https://alnova2.tistory.com/1291 [몽상가:티스토리]

```
$cp config.example.js config.js
$vi config.js (이 부분에서 ssl 패스, 포트 등을 설정해 준다)
$npm install
$npm start
```


1. browserify 설치

```
sudo npm install -g browserify
```

2. 인증서 적용

```
openssl req -newkey rsa:2048 -nodes -keyout server.key -x509 -days 365 -out server.crt

cat server.crt server.key > server.pem

sudo mkdir -p /usr/local/etc/ssl

sudo cp server.key /usr/local/etc/ssl/server.key
sudo cp server.crt /usr/local/etc/ssl/server.crt

sudo chmod 644 /usr/local/etc/ssl/server.key
sudo chmod 644 /usr/local/etc/ssl/server.crt

```

- config파일 변경
```
  sslCrt: '/usr/local/etc/ssl/server.crt',
  sslKey: '/usr/local/etc/ssl/server.key',
```


---


