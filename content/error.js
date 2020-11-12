module.exports.code = function ({q}, code) {
  return code;
};

module.exports.message = function ({q}, code, err) {
  return err ? err.message : 'Unknown Error';
};
