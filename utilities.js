const querystring = require('querystring');

module.exports.getPostData = function (req) {
  if (req.method !== 'POST') {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    let body = '';

    let timeout = setTimeout(() => {
      timeout = null;
      reject(new Error('Time Limit Reached'));
    }, 10000);

    function resolveAndClear (...args) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
        resolve(...args);
      }
    }

    function rejectAndClear (...args) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
        reject(...args);
      }
    }

    req.on('data', chunk => {
      if (timeout) {
        body += chunk.toString(); // convert Buffer to string
      }
    });

    req.on('end', () => {
      if (timeout) {
        if (!body.length) {
          resolveAndClear(null);

          return;
        }

        switch (req.headers['content-type']) {
        case 'application/x-www-form-urlencoded':
          resolveAndClear(querystring.parse(body));
          break;
        case 'application/json':
          resolveAndClear(JSON.parse(body));
          break;
        default:
          break;
        }

        rejectAndClear(new Error('Invalid Post Format'));
      }
    });
  });
};
