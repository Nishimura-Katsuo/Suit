const utilities = require('../utilities.js');

module.exports.title = function () {
  return 'Title';
};

module.exports.body = async function ({ req, session }) {
  let data = await utilities.getPostData(req);

  if (data && data.username === 'test' && data.password === 'test') {
    session.loggedIn = true;
  } else {
    session.loggedIn = false;
  }

  return renderTemplate(session.loggedIn ? 'content/loggedin.fragment.html' : 'content/loggedout.fragment.html');
};
