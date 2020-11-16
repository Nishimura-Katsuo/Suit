let templateSymbol = Symbol();

function cleanAttribute (attr) {
  let start = 0, end = attr.length;

  if (attr[start] === '"') {
    start++;
  }

  if (attr[end - 1] === '"') {
    end--;
  }

  return attr.slice(start, end);
}

class PageTemplate {
  constructor (text) {
    let tokens = text.split(/(<\s*\/?\s*(?:include|fragment|node|content|contents)(?:>|(?:\s*(?:"[^"]*"|[^<>])*)*>?))/i).filter(v => v),
      len = tokens.length,
      pos = 0;

    function tagNode () {
      if (pos < len && /^<\s*\/?\s*(include|fragment|node|content|contents)(\s|\/|<|>)/i.test(tokens[pos])) {
        let node = {},
          c = 0,
          subtokens = tokens[pos++].match(/("[^"]*")|=|\/|[^\s"=<>]+/gi),
          slen = subtokens.length;

        if (subtokens[c] === '/') {
          node.closing = true;
          c++;
        }

        if (subtokens[slen - 1] === '/') {
          node.unary = true;
          slen--;
        }

        node.tag = subtokens[c++];
        node.attributes = {};

        while (c < slen) {
          let name = subtokens[c++];

          if (name !== '/') {
            if (subtokens[c] === '=') {
              c++;

              if (c < slen) {
                node.attributes[name] = cleanAttribute(subtokens[c]);
                c++;
              } else {
                node.attributes[name] = true;
              }
            } else {
              node.attributes[name] = true;
            }
          }
        }

        return node;
      }

      return null;
    }

    function textNode () {
      if (pos < len) {
        return { text: tokens[pos++], unary: true };
      }

      return null;
    }

    function document () {
      let nodes = [], node;

      while (true) {
        node = null;

        if ((node = tagNode())) {
          nodes.push(node);

          if (node.closing) {
            return nodes;
          }

          if (!node.unary) {
            node.children = document();

            if (node.children.length && node.children[node.children.length - 1].closing) {
              let last = node.children.pop();

              if (node.tag !== last.tag) {
                nodes.push(last);
              }
            }
          }

          continue;
        }

        if ((node = textNode())) {
          nodes.push(node);
          continue;
        }

        return nodes;
      }
    }

    this[templateSymbol] = document();
  }

  async build (cb = ({ contents }) => contents) {
    async function process (nodes) {
      let output = '';

      for (let node of nodes) {
        if (node.text) {
          output += node.text;
          continue;
        }

        if (node.closing) {
          continue;
        }

        let contents = '';

        if (node.children) {
          contents = await process(node.children);
        }

        output += await cb({...node, contents});
      }

      return output;
    }

    return await process(this[templateSymbol]);
  }
}

module.exports.PageTemplate = PageTemplate;
