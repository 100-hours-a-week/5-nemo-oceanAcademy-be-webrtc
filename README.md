# 바다서원 - Ocean Academy

<div align="center">
<a href="https://refine.dev/">
    <img alt="refine logo" src="https://gobyeonghu.github.io/PostImages/2024-10-22-OceanAcademy/banner.png">
</a>

<br/>
<br/>

<div align="center">
    <a href="https://github.com/100-hours-a-week/5-nemo-oceanAcademy-be">Github</a> |
    <a href="https://gobyeonghu.github.io/oceanacademy/2024/06/08/OceanAcademy.html">Blog</a>
</div>
</div>

<br/>
<br/>

<div align="center">
개인 라이브 강의 플랫폼 <strong>바다서원</strong>의 프로젝트 소개입니다.
<br />
<br />

</div>

<div align="center">

[![Gmail](https://img.shields.io/badge/Email-ktb.nemo%40gmail.com-blue.svg)](mailto:ktb.nemo@gmail.com)


</div>

<br/>

## Summary
- **기간:** 2024.07.25 ~ 2024.10.04
- **사용 도구:** Spring Boot, Spring Security, Spring Batch, node.js, MySQL, Redis, EC2, S3
- **FE깃헙 리파지토리:** [FE 깃헙 리파지토리 링크](https://github.com/100-hours-a-week/5-nemo-oceanAcademy-fe)
- **BE깃헙 리파지토리:** [BE 깃헙 리파지토리 링크](https://github.com/100-hours-a-week/5-nemo-oceanAcademy-be)
- **미디어중계서버 리파지토리:** [BE 깃헙 리파지토리 링크](https://github.com/100-hours-a-week/5-nemo-oceanAcademy-be-webrtc)

## About the Project

본 프로젝트는 오프라인 교육의 실시간 소통 장점과 온라인 플랫폼의 접근성을 결합
한 라이브 강의 플랫폼을 개발하는 것을 목표로 한다. 또한, WebRTC 기반의 미디어 전
송 최적화와 클라우드 인프라를 도입하여 확장성을 개선하고, 동시 접속자가 많은 상
황에서도 안정적인 스트리밍 환경을 제공한다. 이러한 방식으로 학습자와 강사 간의
상호작용을 극대화하고, 플랫폼의 신뢰성과 사용자 경험을 향상시키고자 한다.
<br>궁극적으로, **본 프로젝트는 학습자들이 언제 어디서나 원활한 환경에서 교육에 집중
할 수 있도록 하여 더 나은 학습 경험을 제공하는 것을 지향한다.**

## Technologies

### Database
- [MySQL](https://www.mysql.com/) 8.1.2
- [Redis](https://redis.io/) 6.2.6
### Backend  
- [Spring Boot](https://spring.io/) 3.3.2
- [Spring Security](https://spring.io/projects/spring-security) 6.2.1
- [Spring Batch](https://spring.io/projects/spring-batch) 5.1.0
### Media Server
- [Node.js](https://nodejs.org/) 14.17.3
- [Express](https://expressjs.com/) 4.16.4
- [Mediasoup](https://mediasoup.org/) 3.0.0
### Frontend
- [React.js](https://ko.legacy.reactjs.org/) 18.3.1
- [TypeScript](https://www.typescriptlang.org/) 4.9.5

## Key Features

1. **강의 탐색 및 수강 신청**
   
    사용자들은 플랫폼 메인 페이지에서 다양한 개설된 강의를 둘러볼 수 있다. 강의 소개
    페이지에서는 강의 내용, 커리큘럼, 강사 정보 등을 자세히 확인할 수 있고, 관심 있는
    강의를 발견하면 “수강 신청” 버튼을 통해 간편하게 등록할 수 있다.

2. **라이브 스트리밍 강의**
   
    라이브 강의에서는 강사가 여러 수강생에게 웹캠 영상, 화면 공유 영상, 오디오를 실시간으로 전송할 수 있다.

3. **실시간 채팅**
   
    라이브 강의 중 강사와 수강생 간의 실시간 소통을 위해 채팅 기능을 도입하였다.
    이를 위해 WebSocket을 사용하였다.

4. **인기강의 순위 제공**
   
    강의 순위 결정 과정은 매일 오전 2시에 일괄적으로 수행되도록 설계되었다. 
    대용량 데이터의 효율적인 처리를 위해 Spring Batch를 활용하였다.

## Architecture

![architecture](https://gobyeonghu.github.io/PostImages/2024-10-22-OceanAcademy/architecture.png)

## MediaSoup Server Getting Started

### Dependencies

* [Mediasoup v3 requirements](https://mediasoup.org/documentation/v3/mediasoup/installation/#requirements)
* Node.js >= v8.6
* [Browserify](http://browserify.org/)


### Run

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


## 데모영상

<iframe width="560" height="315" src="https://www.youtube.com/embed/vAiGR7wuHDE?si=n7wtvJx-Y7rJ4D-4" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>


## Contribution
- [고병후](https://github.com/GoByeonghu)
- [장혜정](https://github.com/Ssun2zang)
- [최유나](https://github.com/ehvzmf)
- [강유석](https://github.com/kangyuseok)
- [김소희](https://github.com/judy-kimsohui)

## Acknowledgement

- [mediasoup-sample-app](https://github.com/mkhahani/mediasoup-sample-app)


## License

Licensed under the MIT License, Copyright © 2024-present Nemo


<!--Url for Badges-->
[license-shield]: https://img.shields.io/github/license/dev-ujin/readme-template?labelColor=D8D8D8&color=04B4AE
[repository-size-shield]: https://img.shields.io/github/repo-size/dev-ujin/readme-template?labelColor=D8D8D8&color=BE81F7
[issue-closed-shield]: https://img.shields.io/github/issues-closed/dev-ujin/readme-template?labelColor=D8D8D8&color=FE9A2E

<!--Url for Buttons-->
[readme-eng-shield]: https://img.shields.io/badge/-readme%20in%20english-2E2E2E?style=for-the-badge
[view-demo-shield]: https://img.shields.io/badge/-%F0%9F%98%8E%20view%20demo-F3F781?style=for-the-badge
[view-demo-url]: https://dev-ujin.github.io
[report-bug-shield]: https://img.shields.io/badge/-%F0%9F%90%9E%20report%20bug-F5A9A9?style=for-the-badge
[report-bug-url]: https://github.com/dev-ujin/readme-template/issues
[request-feature-shield]: https://img.shields.io/badge/-%E2%9C%A8%20request%20feature-A9D0F5?style=for-the-badge
[request-feature-url]: https://github.com/dev-ujin/readme-template/issues

<!--URLS-->
[license-url]: LICENSE.md
[contribution-url]: CONTRIBUTION.md
[readme-eng-url]: ../README.md
