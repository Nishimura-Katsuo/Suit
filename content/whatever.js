const fs = require('fs');

module.exports.title = function ({context}, rando, contextid) {
  return 'arg: ' + rando;
};

module.exports.body = function ({context}, rando, contextid) {
  return 'arg: ' + rando;
};
