# 베이스 이미지 설정
FROM node:22

# 작업 디렉터리 설정
WORKDIR /usr/src/app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 애플리케이션 소스 복사
COPY . .

# 환경 변수 파일 복사
COPY .env .env

# 환경 변수 파일 복사
COPY .env /usr/src/app/.env

# 환경 변수 파일이 제대로 복사되었는지 확인
RUN ls -al /usr/src/app
RUN cat /usr/src/app/.env

# 애플리케이션 실행 포트 개방
EXPOSE 3000

# 애플리케이션 실행
CMD ["npm", "start"]
