const fs = require('fs');

module.exports.title = function ({context}, contextid) {
  return 'arg: ' + contextid;
};

module.exports.body = function ({context}, contextid) {
  return 'arg: ' + contextid;
};
