const utilities = require('../utilities.js');

module.exports = {
  title () {
    return 'Title';
  },

  async body ({ req, session }) {
    let data = await utilities.getPostData(req);

    // Example login
    if (data && data.username === 'test' && data.password === 'test') {
      session.loggedIn = data.username;
    } else {
      session.loggedIn = false;
    }

    return renderTemplate(session.loggedIn ? 'content/loggedin.fragment.html' : 'content/loggedout.fragment.html');  
  },

  getUserName ({ session }) {
    return session.loggedIn;
  }
};
