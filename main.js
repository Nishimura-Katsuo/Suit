/* global Promise */
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

let splitRegex = /(<(?:include|fragment|node)(?:\s*(?:"[^"]*"|'[^']*'|=|[^>=]*))*>?)/;
let tokenize = /"[^"]*"|=|[^="\s]+/g;

async function compileTemplate(filename, files = {}) {
  return new Promise((resolve, reject) => {
    filename = path.resolve(filename);

    files[filename] = true;
  
    fs.readFile(filename, async function (err, data) {
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
                    let newparts = await compileTemplate(current.src, files);
                    parts.splice(c, 1, ...newparts);
                    c += newparts.length - 1;
                  } catch (err) {
                    parts[c] = 'Error loading template: ' + current.src;
                  }
      
                  break;
                case 'node':
                  {
                    let args = current.src.split('#');
                    try {
                      current.src = args[0];
                      current.module = require(args[0]);
                      current.function = args[1];
                      current.args = args.slice(2);
                      files[args[0]] = true;
                    } catch (err) {
                      parts[c] = 'Error loading module: ' + args[0];
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      
        resolve(parts);
      } else {
        reject(err);
      }
    });
  });
}

async function renderTemplate (renderParts, ...args) {
  let output = '';

  for (let part of renderParts) {
    if (typeof part === 'string') {
      output += part;
    } else {
      try {
        if (part.module && part.function) {
          if (typeof part.module[part.function] === 'function') {
            output += await part.module[part.function](...args, ...part.args);
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

(async function () {
  let start, celapsed, relapsed;
  start = performance.now();
  let files = {}, parts = await compileTemplate('content/index.node.html', files);
  celapsed = performance.now() - start;
  start = performance.now();
  let output = await renderTemplate(parts);
  relapsed = performance.now() - start;
  console.log(output);
  console.log('Compile Elapsed:', celapsed);
  console.log('Render Elapsed:', relapsed);
})();
