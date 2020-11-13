/* global process */
const Module = require('module');
const fs = require('fs');
const path = require('path');

const originalRequire = Module.prototype.require;

let fileDeps = {};

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

function resolveName(filename, type, parent) {
  if (type === 'require') {
    if (!Object.keys(process.binding('natives')).includes(filename)) {
      if (parent) {
        filename = Module._resolveFilename(filename, parent, false);
      } else {
        filename = path.resolve(filename);
      }
    }
  } else {
    filename = path.resolve(filename);
  }

  return filename;
}

Module.prototype.require = function(...args) {
  let prev = getStack()[0].getFileName();
  depType(prev, 'require', this);
  depType(args[0], 'require', this);
  addDep(prev, 'require', args[0], 'require', this);
  return setCache(args[0], 'require', originalRequire.apply(this, args));
};

function depType(name, type, parent) {
  name = resolveName(name, type, parent);
  fileDeps[name] = fileDeps[name] || {};
  fileDeps[name].type = type;
}

function addDep(src, srcType, filename, filenameType, parent) {
  src = resolveName(src, srcType, parent);
  filename = resolveName(filename, filenameType, parent);
  fileDeps[filename] = fileDeps[filename] || {};
  fileDeps[filename].dependants = fileDeps[filename].dependants || {};
  fileDeps[filename].dependants[src] = true;
}

function invalidateCache(filename, parent) {
  if (fileDeps[filename] && fileDeps[filename].cache) {
    if (fileDeps[filename].type) {
      filename = resolveName(filename, fileDeps[filename].type, parent);
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

function setCache(filename, type, cache, parent) {
  filename = resolveName(filename, type, parent);
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
