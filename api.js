module.exports.request = function ({ res }) {
  res.writeHead(200, { 'Content-Type': 'text/json' });

  return JSON.stringify({
    a: true,
    b: false,
    c: {
      wtf: 'poot',
    },
  });
};
