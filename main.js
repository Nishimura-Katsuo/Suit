/* global Promise Symbol __filename */
const Module = require('module');
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

function depType(name, type) {
  if (name !== __filename) {
    fileDeps[name] = fileDeps[name] || {};
    fileDeps[name].type = type;
  }
}

function addDep(src, filename) {
  if (src !== __filename && filename !== __filename) {
    fileDeps[filename] = fileDeps[filename] || {};
    fileDeps[filename].dependants = fileDeps[filename].dependants || {};
    fileDeps[filename].dependants[src] = true;
  }
}

function setCache(filename, cache) {
  fileDeps[filename] = fileDeps[filename] || {};
  fileDeps[filename].cache = cache;
  return cache;
}

Module.prototype.require = function(...args) {
  let prev = getStack()[0].getFileName();
  depType(prev, 'require');
  depType(args[0], 'require');
  addDep(prev, args[0]);
  return originalRequire.apply(this, args);
};

const fs = require('fs');
const path = require('path');
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
      filename = path.resolve(filename);

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
                      addDep(filename, current.src);
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
                        addDep(filename, args[0]);
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
              output += '<details><summary>Error</summary><p style="position: absolute !important">Function "' + part.function + '" not found in: ' + part.src + '<p></details>';
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

async function renderPage(filename, ...args) {
  let template;

  filename = path.resolve(filename);

  if (!fileDeps[filename] || !fileDeps[filename].cache) {
    template = await PageTemplate.compileTemplate('content/index.node.html');
  } else {
    template = fileDeps[filename].cache;
  }

  return template.renderTemplate(...args);
}

(async function () {
  let start, celapsed, relapsed;
  start = performance.now();
  await PageTemplate.compileTemplate('content/index.node.html');
  celapsed = performance.now() - start;
  console.log('Compile Elapsed:', celapsed);
  console.log('deps', fileDeps);
  let total = 0, count = 0;

  for (let c = 0; c < 50; c++) {
    start = performance.now();
    let output = await renderPage('content/index.node.html', Math.random());
    relapsed = performance.now() - start;
    total += relapsed;
    count++;
    console.log('='.repeat(40));
    console.log(output);
    console.log('Render Elapsed:', relapsed);  
  }

  console.log('='.repeat(40));
  console.log('Average Render Time:', total / count);
})();
