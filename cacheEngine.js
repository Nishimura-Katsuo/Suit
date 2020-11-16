const Module = require('module');
const fs = require('fs');

const originalRequire = Module.prototype.require;

let fileDeps = {}, excludedFiles = {};

excludedFiles[__filename] = true;

Object.keys(process.binding('natives')).forEach(name => {
  excludedFiles[name] = true;
});

function getStack () {
  let origPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  let stack = new Error().stack;
  Error.prepareStackTrace = origPrepareStackTrace;
  stack.shift();
  stack.shift();
  stack.shift();

  return stack;
}

function resolveRequireFilename (filename, parent) {
  if (!Object.keys(process.binding('natives')).includes(filename)) {
    filename = Module._resolveFilename(filename, parent, false);
  }

  return filename;
}

function depType (filename, type) {
  if (excludedFiles[filename]) {
    return;
  }

  fileDeps[filename] = fileDeps[filename] || {};
  fileDeps[filename].type = type;
}

function addDep (src, filename) {
  if (excludedFiles[filename] || excludedFiles[src]) {
    return;
  }

  fileDeps[filename] = fileDeps[filename] || {};
  fileDeps[filename].dependants = fileDeps[filename].dependants || {};
  fileDeps[filename].dependants[src] = true;
}

function invalidateCache (filename) {
  if (fileDeps[filename] && fileDeps[filename].cache) {
    if (fileDeps[filename].type === 'require') {
      if (require.cache[filename]) {
        delete require.cache[filename];
      }
    }

    fileDeps[filename].cache = null;

    if (fileDeps[filename].dependants) {
      Object.keys(fileDeps[filename].dependants).forEach(dependant => {
        if (fileDeps[filename].dependants[dependant]) {
          invalidateCache(dependant);
        }
      });
    }
  }
}

function setCache (filename, cache) {
  if (excludedFiles[filename]) {
    return cache;
  }

  fileDeps[filename] = fileDeps[filename] || {};
  fileDeps[filename].cache = cache;

  if (!fileDeps[filename].watcher && fs.existsSync(filename)) {
    fileDeps[filename].watcher = fs.watch(filename, {
      persistent: true,
    }, () => {
      invalidateCache(filename);
      fileDeps[filename].watcher.close();
      fileDeps[filename].watcher = null;
    });
  }

  return cache;
}

Module.prototype.require = function (...args) {
  let prev = getStack()[0].getFileName();
  let current = resolveRequireFilename(args[0], this);

  depType(prev, 'require');
  depType(current, 'require');
  addDep(prev, current);

  return setCache(current, originalRequire.apply(this, args));
};

module.exports = {
  fileDeps,
  excludedFiles,
  depType,
  addDep,
  setCache,
};
