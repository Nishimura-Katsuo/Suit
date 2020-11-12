module.exports.route = function (q) {
  console.log(q.pathname);
  switch(q.pathname) {
  case '/':
  case '/index':
  case '/index.html':
    return 'content/index.html';
  }
};
