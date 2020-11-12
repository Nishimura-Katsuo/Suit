/* global process */
const Module = require('module');
const fs = require('fs');
const path = require('path');

const originalRequire = Module.prototype.require;

let fileDeps = {};

function resolveName(filename, type) {
  if (type === 'require') {
    if (!Object.keys(process.binding('natives')).includes(filename)) {
      filename = require.resolve(filename);
    }
  } else {
    filename = path.resolve(filename);
  }

  return filename;
}

function getStack() {
  let origPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  let stack = new Error().stack;
  Error.prepareStackTrace = origPrepareStackTrace;
  stack.shift();
  stack.shift();
  stack.shift();
  return stack;
}

Module.prototype.require = function(...args) {
  let prev = getStack()[0].getFileName();
  depType(prev, 'require');
  depType(args[0], 'require');
  addDep(prev, 'require', args[0], 'require');
  return setCache(args[0], 'require', originalRequire.apply(this, args));
};

function depType(name, type) {
  name = resolveName(name, type);
  fileDeps[name] = fileDeps[name] || {};
  fileDeps[name].type = type;
}

function addDep(src, srcType, filename, filenameType) {
  src = resolveName(src, srcType);
  filename = resolveName(filename, filenameType);
  fileDeps[filename] = fileDeps[filename] || {};
  fileDeps[filename].dependants = fileDeps[filename].dependants || {};
  fileDeps[filename].dependants[src] = true;
}

function invalidateCache(filename) {
  if (fileDeps[filename] && fileDeps[filename].cache) {
    if (fileDeps[filename].type) {
      filename = resolveName(filename, fileDeps[filename].type);
    }

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

function setCache(filename, type, cache) {
  filename = resolveName(filename, type);
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

module.exports = {
  fileDeps,
  resolveName,
  depType,
  addDep,
  setCache,
};
