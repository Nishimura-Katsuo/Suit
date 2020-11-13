const utilities = require('../utilities.js');

module.exports = {
  async login (...args) {
    let { req, res, session } = args[0];
    let data = await utilities.getPostData(req);

    // Example login
    if (data && data.action === 'login') {
      if (data.username === 'test' && data.password === 'test') {
        session.loggedIn = data.username;
      } else {
        session.loggedIn = false;
      }

      res.writeHead(307, { Location: '/' });

      return;
    }

    return renderTemplate('content/login.html', ...args);
  },

  getUserName ({ session }) {
    return session.loggedIn || '(not logged in)';
  }
};
