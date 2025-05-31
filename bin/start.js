#!/usr/bin/env node

/**
 * Podcast Backend API 启动脚本
 */

const app = require('../app');
const http = require('http');

/**
 * 获取端口号
 */
const port = normalizePort(process.env.PORT || '3000');

/**
 * 创建HTTP服务器
 */
const server = http.createServer(app.callback());

/**
 * 监听端口
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * 标准化端口号
 */
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * HTTP服务器错误处理
 */
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * HTTP服务器监听事件处理
 */
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  console.log('Podcast Backend API listening on ' + bind);
  console.log(`API endpoints:`);
  console.log(`  GET http://localhost:${addr.port}/api/feed?url=<rss_url>`);
  console.log(`  GET http://localhost:${addr.port}/api/feed?all=1`);
}