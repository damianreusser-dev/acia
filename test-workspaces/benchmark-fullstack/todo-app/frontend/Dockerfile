FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# build if a build script exists
RUN npm run build --if-present

FROM node:20-alpine
WORKDIR /app
# create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# copy build output (if any)
COPY --from=builder /app/build ./build
# serve static site using "serve" if build exists, otherwise run npm start
RUN npm install -g serve --no-audit --no-fund
EXPOSE 3000
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
USER appuser
# If there's a build directory, serve it. Otherwise fall back to npm start.
CMD ["sh","-c","if [ -d ./build ]; then serve -s build -l 3000; else npm start; fi"]
