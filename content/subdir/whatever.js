module.exports.title = function (params, { args }) {
  return 'Title: ' + args;
};

module.exports.body = function (params, { args }) {
  return 'Body: ' + args;
};

module.exports.showquery = function ({q}) {
  return JSON.stringify(q, null, ' ');
};
