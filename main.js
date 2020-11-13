global.renderTemplate = require('./templateEngine.js').renderTemplate;
const http = require('http');
const WebSocket = require('ws');
const cluster = require('cluster');
const sessions = require('client-sessions');
const settings = require('./settings.js');

let requestSessionHandler = sessions(settings.session);

if (cluster.isMaster) {
  cluster.fork();
  cluster.on('exit', worker => {
    console.log(`[${process.pid} @ ${new Date().toUTCString()}] Child ${worker.process.pid} died!`);
    cluster.fork();
  });
} else {
  let server = http.createServer((req, res) => {
    requestSessionHandler(req, res, async function () {
      try {
        await require('./router').route({req, res});
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        console.log(err.stack ? err.stack : err.toString());
        res.write(err.stack ? err.stack : err.toString());
        res.end();
      }
    });
  });

  let wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    try {
      if (!(await require('./router').connect({req, ws, wss}))) {
        ws.terminate();
      }
    } catch (err) {
      console.log(err.stack ? err.stack : err.toString());
    }
  });

  server.listen(1234);

  process.on('uncaughtException', err => {
    console.log(err.stack ? err.stack : err.toString());
    process.kill(process.pid);
  });
}
