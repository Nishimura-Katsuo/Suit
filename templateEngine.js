const fs = require('fs');
const path = require('path');
const { fileDeps, depType, setCache } = require('./cacheEngine.js');

function renderTemplate (filename, context = {}, ...args) {
  return new Promise((resolve, reject) => {
    filename = path.resolve(filename);

    depType(filename, 'template');

    context = {...context, src: filename};

    async function process (node) {
      if (node.attributes.src && ['include', 'fragment'].includes(node.tag)) {
        let nodefilename = path.resolve(path.dirname(filename), node.attributes.src);

        return await renderTemplate(nodefilename, {...context, node, parent: context}, ...args);
      }

      if (node.attributes.src && node.tag === 'node') {
        let parts = node.attributes.src.split('#');

        if (parts.length < 1) {
          return '(no file specified)';
        }

        if (parts.length < 2) {
          return '(no function specified)';
        }

        try {
          let mod = require(path.resolve(path.dirname(filename), parts[0]));

          if (!mod) {
            return '(module "' + parts[0] + '" not found)';
          }

          if (!mod[parts[1]]) {
            return '(function "' + parts[1] + '" in module "' + parts[0] + '" not found)';
          }

          return await mod[parts[1]]({...context, node, parent: context}, ...args);
        } catch (err) {
          return err && err.stack ? err.stack : err;
        }
      }

      return context && context.node.contents || '';
    }

    if (!fileDeps[filename] || !fileDeps[filename].cache) {
      fs.readFile(filename, (err, data) => {
        if (err) {
          reject(err);
        } else {
          const { PageTemplate } = require('./xmlParser.js');
          let template = setCache(filename, new PageTemplate(data.toString()));
          template.build(process).then(output => resolve(output));
        }
      });
    } else {
      fileDeps[filename].cache.build(process).then(output => resolve(output));
    }
  });
}

module.exports.renderTemplate = renderTemplate;
