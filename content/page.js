module.exports = {
  async login (...args) {
    const utilities = require('../utilities.js');
    const settings = require('../settings.js');
    const renderTemplate = require('../templateEngine.js').renderTemplate;

    let { req, res, session } = args[0];
    let data = await utilities.getPostData(req);

    // Example login
    if (data && data.action === 'login') {
      if (data.username === settings.username && data.password === settings.password) {
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
