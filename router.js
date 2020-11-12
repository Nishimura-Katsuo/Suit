const url = require('url');
const { renderTemplate } = require('./templateEngine');

module.exports.route = async function (req, res) {
  let q = url.parse(req.url, true), output;

  switch(q.pathname) {
  case '/index':
  case '/index.html':
    res.writeHead(301, {
      'Location': '/',
    });
    res.end();
    return;
  case '/':
    output = await renderTemplate('content/index.html', {q, req, res});
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(output);
    res.end();
    return;
  case '/api':
    output = await require('./content/api.js').request({q, req, res});
    res.write(output);
    res.end();
    return;
  }

  output = await renderTemplate('error/404.html', {q, res, req});
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.write(output);
  res.end();
};
