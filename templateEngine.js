/* global Promise Symbol */
const fs = require('fs');
const path = require('path');
const { fileDeps, resolveName, depType, addDep, setCache } = require('./cacheEngine.js');
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
                        current.parent = filename;
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
        
          resolve(setCache(filename, 'template', new this(parts)));
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
              output += await part.module[part.function](...args, {
                context: contexts[part.src] = contexts[part.src] || {},
                global: globalContext,
                args: part.args,
                parent: part.parent,
              });
            } else {
              output += '<details><summary>Error</summary><p>Function "' + part.function + '" not found or callable in: ' + part.src + '<p></details>';
            }
          }
        } catch (err) {
          output += '<details><summary>Error</summary><pre>' + err.stack + '</pre></details>';
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

module.exports.renderTemplate = renderTemplate;
