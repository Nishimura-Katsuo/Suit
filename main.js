global.renderTemplate = require('./templateEngine.js').renderTemplate; /* global renderTemplate */
const http = require('http');
const url = require('url');

http.createServer((req, res) => {
  try {
    let q = url.parse(req.url, true), filename = require('./router').route(q, req);

    if (filename) {
      renderTemplate(filename, {q, res, req}).then(output => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(output);
        res.end();  
      }).catch(err => {
        let code = err.code && err.code === 'ENOENT' ? 404 : 500;
    
        renderTemplate('content/error.html', {q, res, req}, code, err).then(output => {
          res.writeHead(code, { 'Content-Type': 'text/html' });
          res.write(output);
          res.end();
        }).catch(err => {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.write(JSON.stringify(err));  
          res.end();
        });
      });
    } else {
      renderTemplate('content/error.html', {q, res, req}, 404, new Error('Route Not Found:' + q.pathname)).then(output => {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.write(output);
        res.end();
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.write(err.stack ? err.stack : err.toString());  
        res.end();
      });
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.write(err.stack ? err.stack : err.toString());
    res.end();
  }
}).listen(1234);
