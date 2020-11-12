const url = require('url');
const { renderTemplate } = require('./templateEngine');

module.exports.route = async function (req, res) {
  let q = url.parse(req.url, true), output;

  switch(q.pathname) {
  case '/index':
  case '/index.html':
    output = await renderTemplate('content/index.html', {q, req, res});
    res.writeHead(301, {
      'Content-Type': 'text/html',
      'Location': '/',
    });
    res.write(output);
    res.end();
    return;
  case '/':
    output = await renderTemplate('content/index.html', {q, req, res});
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(output);
    res.end();
    return;
  case '/api':
    output = await require('./api.js').request({q, req, res});
    res.write(output);
    res.end();
    return;
  }

  output = await renderTemplate('content/error.html', {res, req}, 404, new Error('Route Not Found:' + req.url));
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.write(output);
  res.end();
};
