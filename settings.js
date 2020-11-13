module.exports = {
  root: './content',
  session: {
    cookieName: 'session',
    secret: 'somelongstring', //require('crypto').randomBytes(64),
    duration: 2.628e9,
    activeDuration: 1.314e9,
    cookie: {
      httpOnly: true,
      secure: false,
    },
  }
};
