/* global Promise Symbol __filename process */
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
  return setCache(args[0], originalRequire.apply(this, args));
};

function depType(name, type) {
  name = resolveName(name, type);
  if (name !== __filename) {
    fileDeps[name] = fileDeps[name] || {};
    fileDeps[name].type = type;
  }
}

function addDep(src, srcType, filename, filenameType) {
  src = resolveName(src, srcType);
  filename = resolveName(filename, filenameType);

  if (src !== __filename && filename !== __filename) {
    fileDeps[filename] = fileDeps[filename] || {};
    fileDeps[filename].dependants = fileDeps[filename].dependants || {};
    fileDeps[filename].dependants[src] = true;
  }
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
    console.log('Invalidated:', filename);

    if (fileDeps[filename].dependants) {
      Object.keys(fileDeps[filename].dependants).forEach(dependant => {
        if (fileDeps[filename].dependants[dependant]) {
          invalidateCache(dependant);
        }
      });
    }
  }
}

function setCache(filename, cache) {
  if (fileDeps[filename] && fileDeps[filename].type) {
    filename = resolveName(filename, fileDeps[filename].type);
    fileDeps[filename] = fileDeps[filename] || {};
    fileDeps[filename].cache = cache;
    if (!fileDeps[filename].watcher && fs.existsSync(filename)) {
      fileDeps[filename].watcher = fs.watch(filename, {
        persistent: true,
      }, () => {
        invalidateCache(filename);
      });
    }  
  }
  return cache;
}

const { performance } = require('perf_hooks');

let splitRegex = /(<(?:include|fragment|node)(?:\s*(?:"[^"]*"|'[^']*'|=|[^>=]*))*>?)/;
let tokenize = /"[^"]*"|=|[^="\s]+/g;

let partSymbol = Symbol();

class PageTemplate {
  constructor (parts) {
    this[partSymbol] = parts;
  }

  static compileTemplate (filename) {
    return new Promise((resolve, reject) => {
      filename = resolveName(filename, 'template');

      fs.readFile(filename, async (err, data) => {
        depType(filename, 'template');
        if (!err) {
          let parts = data.toString().split(splitRegex);
          for (let c = 0; c < parts.length; c++) {
            let tag, taglen;
        
            if (typeof parts[c] === 'string') {
              if (parts[c].slice(0, taglen = 9) === '<include ') {
                tag = parts[c].slice(1, taglen - 1).toLowerCase();
                parts[c] = parts[c].slice(taglen).trim();
              }
            
              if (parts[c].slice(0, taglen = 10) === '<fragment ') {
                tag = parts[c].slice(1, taglen - 1).toLowerCase();
                parts[c] = parts[c].slice(taglen).trim();
              }
            
              if (parts[c].slice(0, taglen = 6) === '<node ') {
                tag = parts[c].slice(1, taglen - 1).toLowerCase();
                parts[c] = parts[c].slice(taglen).trim();
              }
            
              if (tag) {
                if (parts[c][parts[c].length - 1] === '>') {
                  parts[c] = parts[c].slice(0, -1).trim();
                }
            
                if (parts[c][parts[c].length - 1] === '/') {
                  parts[c] = parts[c].slice(0, -1).trim();
                }
            
                let tokens = parts[c].match(tokenize).map(v => {
                  let start = 0, end = v.length;
                  if (v[start] === '"') {
                    start++;
                  }
                  if (v[end - 1] === '"') {
                    end--;
                  }
                  return v.slice(start, end);
                });
            
                let current = parts[c] = {
                  tag,
                };
            
                for (let c = 0; c < tokens.length; c++) {
                  if (tokens[c + 1] === '=' && tokens[c + 2]) {
                    current[tokens[c]] = tokens[c + 2];
                    c += 2;
                  }
                }
        
                if (current.src) {
                  current.src = path.resolve(path.dirname(filename), current.src);
                }
        
                if (!current.tag || !current.src) {
                  parts.splice(c, 1);
                  c--;
                } else {
                  switch (tag) {
                  case 'include':
                  case 'fragment':
                    try {
                      let newparts = (await this.compileTemplate(current.src))[partSymbol];
                      addDep(filename, 'template', current.src, 'template');
                      parts.splice(c, 1, ...newparts);
                      c += newparts.length - 1;
                    } catch (err) {
                      parts[c] = 'Error loading template: ' + current.src + ' (' + err + ')';
                    }
        
                    break;
                  case 'node':
                    {
                      let args = current.src.split('#');
                      try {
                        current.src = args[0];
                        current.module = require(args[0]);
                        addDep(filename, 'template', args[0], 'require');
                        current.function = args[1];
                        current.args = args.slice(2);
                      } catch (err) {
                        parts[c] = 'Error loading module: ' + args[0] + ' (' + err + ')';
                      }
                    }
                    break;
                  }
                }
              }
            }
          }
        
          resolve(setCache(filename, new this(parts)));
        } else {
          reject(err);
        }
      });
    });
  }  

  async renderTemplate (...args) {
    let output = '', contexts = {}, globalContext = {};
  
    for (let part of this[partSymbol]) {
      if (typeof part === 'string') {
        output += part;
      } else {
        try {
          if (part.module && part.function) {
            if (typeof part.module[part.function] === 'function') {
              output += await part.module[part.function]({
                context: contexts[part.src] = contexts[part.src] || {},
                global: globalContext,
              }, ...args, ...part.args);
            } else {
              output += '<details><summary>Error</summary><p style="position: absolute !important">Function "' + part.function + '" not found or callable in: ' + part.src + '<p></details>';
            }
          }
        } catch (err) {
          output += '<details><summary>Error</summary><pre style="position: absolute !important">' + err.stack + '</pre></details>';
        }
      }
    }
  
    return output;
  }  
}

async function renderTemplate(filename, ...args) {
  let template;

  filename = resolveName(filename, 'template');

  if (!fileDeps[filename] || !fileDeps[filename].cache) {
    template = await PageTemplate.compileTemplate(filename);
  } else {
    template = fileDeps[filename].cache;
  }

  return template.renderTemplate(...args);
}
