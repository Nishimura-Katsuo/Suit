const url = require('url');

module.exports.route = async function (...args) {
  let req = args[0].req, res = args[0].res;
  let q = url.parse(req.url, true), output;

  args[0].q = q;
  args[0].session = req.session;

  switch (q.pathname) {
  case '/index':
  case '/index.html':
    res.writeHead(301, {
      'Location': '/',
    });
    res.end();

    return;
  case '/':
    output = await renderTemplate('content/index.html', ...args);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(output && output.toString ? output.toString() : '');
    res.end();

    return;
  case '/login':
    output = await require('./content/page.js').login(...args);
    res.write(output && output.toString ? output.toString() : '');
    res.end();

    return;
  case '/api':
    output = await require('./content/api.js').request(...args);
    res.write(output && output.toString ? output.toString() : '');
    res.end();

    return;
  default:
    break;
  }

  output = await renderTemplate('error/404.html', ...args);
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.write(output && output.toString ? output.toString() : '');
  res.end();
};

module.exports.connect = async function (...args) {
  let req = args[0].req;
  let q = url.parse(req.url, true);
  args[0].q = q;

  switch (q.pathname) {
  case '/api':
    return require('./content/api.js').connect(...args);
  default:
    break;
  }

  return false;
};
