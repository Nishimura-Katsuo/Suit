global.renderTemplate = require('./templateEngine.js').renderTemplate;
const http = require('http');

http.createServer(async (req, res) => {
  try {
    await require('./router').route(req, res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.write(err.stack ? err.stack : err.toString());
    res.end();
  }
}).listen(1234);
