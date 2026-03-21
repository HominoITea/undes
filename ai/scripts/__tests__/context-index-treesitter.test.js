const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

function createNode({ type, text = '', row = 0, endRow = row, fields = {}, children = [] }) {
  const node = {
    type,
    text,
    _fields: { ...fields },
    _children: [...children],
    startPosition: { row },
    endPosition: { row: endRow },
    childForFieldName(name) {
      return this._fields[name] || null;
    },
    get namedChildCount() {
      return this._children.length;
    },
    namedChild(index) {
      return this._children[index] || null;
    },
    walk() {
      return createCursor(this);
    },
  };
  return node;
}

function createCursor(rootNode) {
  const stack = [{ node: rootNode, index: 0 }];
  return {
    get currentNode() {
      return stack[stack.length - 1].node;
    },
    gotoFirstChild() {
      const current = stack[stack.length - 1].node;
      if (!current._children.length) return false;
      stack.push({ node: current._children[0], index: 0 });
      return true;
    },
    gotoNextSibling() {
      if (stack.length < 2) return false;
      const parent = stack[stack.length - 2].node;
      const nextIndex = stack[stack.length - 1].index + 1;
      if (nextIndex >= parent._children.length) return false;
      stack[stack.length - 1] = { node: parent._children[nextIndex], index: nextIndex };
      return true;
    },
    gotoParent() {
      if (stack.length < 2) return false;
      stack.pop();
      return true;
    },
  };
}

function makeParserClass(rootBuilder, { throwOnParse = false } = {}) {
  return class FakeParser {
    setLanguage() {}

    parse(content) {
      if (throwOnParse) {
        throw new Error('parse failed');
      }
      return { rootNode: rootBuilder(content) };
    }
  };
}

function loadTreeSitterModule({ moduleMocks = {}, missingModules = [] } = {}) {
  const modulePath = require.resolve('../context-index-treesitter');
  const previousModule = require.cache[modulePath];
  const originalLoad = Module._load;

  delete require.cache[modulePath];

  Module._load = function patchedLoad(request, parent, isMain) {
    if (missingModules.includes(request)) {
      const err = new Error(`Cannot find module '${request}'`);
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }
    if (Object.prototype.hasOwnProperty.call(moduleMocks, request)) {
      return moduleMocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let mod;
  try {
    mod = require('../context-index-treesitter');
  } catch (error) {
    Module._load = originalLoad;
    if (previousModule) require.cache[modulePath] = previousModule;
    throw error;
  }

  function restore() {
    Module._load = originalLoad;
    delete require.cache[modulePath];
    if (previousModule) require.cache[modulePath] = previousModule;
  }

  return { mod, restore };
}

test('isTreeSitterAvailable returns false when tree-sitter module is missing', () => {
  const { mod, restore } = loadTreeSitterModule({
    missingModules: ['tree-sitter'],
  });
  try {
    assert.equal(mod.isTreeSitterAvailable(), false);
  } finally {
    restore();
  }
});

test('extractSymbolsAst returns null for unsupported extension', () => {
  const FakeParser = makeParserClass(() => createNode({ type: 'program' }));
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-javascript': {},
    },
  });
  try {
    const out = mod.extractSymbolsAst('docs/readme.txt', 'hello');
    assert.equal(out, null);
  } finally {
    restore();
  }
});

test('extractSymbolsAst extracts JS symbols and trims signatures', () => {
  const rootBuilder = () => {
    const nameFoo = createNode({ type: 'identifier', text: 'foo' });
    const nameBar = createNode({ type: 'identifier', text: 'bar' });
    const arrowFn = createNode({ type: 'arrow_function', row: 1, endRow: 1 });
    const varDecl = createNode({
      type: 'variable_declarator',
      row: 1,
      endRow: 1,
      fields: { name: nameBar, value: arrowFn },
    });
    const lexical = createNode({
      type: 'lexical_declaration',
      row: 1,
      endRow: 1,
      children: [varDecl],
    });
    const fnDecl = createNode({
      type: 'function_declaration',
      row: 0,
      endRow: 0,
      fields: { name: nameFoo },
    });
    return createNode({ type: 'program', children: [fnDecl, lexical] });
  };
  const FakeParser = makeParserClass(rootBuilder);
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-javascript': {},
    },
  });

  try {
    const content = [
      'export function foo() { return 1; }',
      'const bar = () => 1;',
      '',
    ].join('\n');
    const symbols = mod.extractSymbolsAst('src/file.js', content);
    assert.equal(Array.isArray(symbols), true);
    assert.equal(symbols.length, 2);

    const byName = new Map(symbols.map((sym) => [sym.name, sym]));
    assert.equal(byName.get('foo').type, 'function');
    assert.equal(byName.get('foo').startLine, 1);
    assert.equal(byName.get('foo').signature, 'export function foo() {');

    assert.equal(byName.get('bar').type, 'const-fn');
    assert.equal(byName.get('bar').startLine, 2);
    assert.equal(byName.get('bar').signature, 'const bar = () => 1;');
  } finally {
    restore();
  }
});

test('extractAstMetadata enriches JS symbols with container, bodyLines, and outline', () => {
  const rootBuilder = () => {
    const className = createNode({ type: 'identifier', text: 'OrderService' });
    const methodName = createNode({ type: 'property_identifier', text: 'placeOrder' });
    const method = createNode({
      type: 'method_definition',
      row: 1,
      endRow: 4,
      fields: { name: methodName },
    });
    const classDecl = createNode({
      type: 'class_declaration',
      row: 0,
      endRow: 5,
      fields: { name: className },
      children: [method],
    });

    const fnName = createNode({ type: 'identifier', text: 'handleSubmit' });
    const arrowFn = createNode({ type: 'arrow_function', row: 6, endRow: 8 });
    const varDecl = createNode({
      type: 'variable_declarator',
      row: 6,
      endRow: 8,
      fields: { name: fnName, value: arrowFn },
    });
    const lexical = createNode({
      type: 'lexical_declaration',
      row: 6,
      endRow: 8,
      children: [varDecl],
    });

    return createNode({ type: 'program', children: [classDecl, lexical] });
  };

  const FakeParser = makeParserClass(rootBuilder);
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-typescript': { typescript: {} },
    },
  });

  try {
    const content = [
      'export class OrderService {',
      '  async placeOrder() {',
      '    return true;',
      '  }',
      '}',
      '',
      'export const handleSubmit = async () => {',
      '  return true;',
      '};',
    ].join('\n');

    const metadata = mod.extractAstMetadata('src/file.ts', content);
    assert.ok(metadata);
    assert.equal(metadata.trust, 'exact-ast');

    const byName = new Map(metadata.symbols.map((sym) => [sym.name, sym]));
    assert.equal(byName.get('OrderService').container, '<module>');
    assert.equal(byName.get('OrderService').containerType, 'module');
    assert.equal(byName.get('placeOrder').container, 'OrderService');
    assert.equal(byName.get('placeOrder').containerType, 'class');
    assert.equal(byName.get('placeOrder').bodyLines, 3);
    assert.deepEqual(byName.get('placeOrder').params, []);
    assert.equal(byName.get('placeOrder').returnType, '');
    assert.equal(byName.get('placeOrder').isAsync, true);
    assert.equal(byName.get('handleSubmit').container, '<module>');
    assert.equal(byName.get('handleSubmit').containerType, 'module');
    assert.equal(byName.get('handleSubmit').isAsync, true);

    assert.equal(metadata.outline.length, 2);
    assert.equal(metadata.outline[0].name, 'OrderService');
    assert.equal(metadata.outline[0].children.length, 1);
    assert.equal(metadata.outline[0].children[0].name, 'placeOrder');
    assert.equal(metadata.outline[1].name, 'handleSubmit');
  } finally {
    restore();
  }
});

test('extractAstMetadata nests Python methods under class outline', () => {
  const rootBuilder = () => {
    const className = createNode({ type: 'identifier', text: 'UserService' });
    const methodName = createNode({ type: 'identifier', text: 'save' });
    const method = createNode({
      type: 'function_definition',
      row: 1,
      endRow: 3,
      fields: { name: methodName },
    });
    const classDecl = createNode({
      type: 'class_definition',
      row: 0,
      endRow: 4,
      fields: { name: className },
      children: [method],
    });
    return createNode({ type: 'module', children: [classDecl] });
  };

  const FakeParser = makeParserClass(rootBuilder);
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-python': {},
    },
  });

  try {
    const metadata = mod.extractAstMetadata('src/service.py', [
      'class UserService:',
      '    def save(self):',
      '        return True',
      '',
    ].join('\n'));

    assert.ok(metadata);
    const save = metadata.symbols.find((sym) => sym.name === 'save');
    assert.equal(save.container, 'UserService');
    assert.equal(save.containerType, 'class');
    assert.deepEqual(save.params, [{ name: 'self', type: '' }]);
    assert.equal(save.returnType, '');
    assert.equal(metadata.outline[0].children[0].name, 'save');
  } finally {
    restore();
  }
});

test('extractAstMetadata binds Java and C# methods to enclosing classes', () => {
  const javaRootBuilder = () => {
    const className = createNode({ type: 'identifier', text: 'OrderController' });
    const methodName = createNode({ type: 'identifier', text: 'createOrder' });
    const method = createNode({
      type: 'method_declaration',
      row: 1,
      endRow: 3,
      fields: { name: methodName },
    });
    return createNode({
      type: 'program',
      children: [
        createNode({
          type: 'class_declaration',
          row: 0,
          endRow: 4,
          fields: { name: className },
          children: [method],
        }),
      ],
    });
  };

  const csharpRootBuilder = () => {
    const className = createNode({ type: 'identifier', text: 'OrdersService' });
    const methodName = createNode({ type: 'identifier', text: 'Create' });
    const method = createNode({
      type: 'method_declaration',
      row: 1,
      endRow: 3,
      fields: { name: methodName },
    });
    return createNode({
      type: 'compilation_unit',
      children: [
        createNode({
          type: 'class_declaration',
          row: 0,
          endRow: 4,
          fields: { name: className },
          children: [method],
        }),
      ],
    });
  };

  let loaded = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': makeParserClass(javaRootBuilder),
      'tree-sitter-java': {},
    },
  });
  try {
    const metadata = loaded.mod.extractAstMetadata('src/Main.java', [
      'class OrderController {',
      '  public Order createOrder(String orderId) {',
      '    return new Order();',
      '  }',
      '}',
    ].join('\n'));
    const createOrder = metadata.symbols.find((sym) => sym.name === 'createOrder');
    assert.equal(createOrder.container, 'OrderController');
    assert.deepEqual(createOrder.params, [{ name: 'orderId', type: 'String' }]);
    assert.equal(createOrder.returnType, 'Order');
    assert.equal(createOrder.visibility, 'public');
    assert.equal(metadata.outline[0].children[0].name, 'createOrder');
  } finally {
    loaded.restore();
  }

  loaded = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': makeParserClass(csharpRootBuilder),
      'tree-sitter-c-sharp': {},
    },
  });
  try {
    const metadata = loaded.mod.extractAstMetadata('src/App.cs', [
      'class OrdersService {',
      '  public static Order Create(string orderId) {',
      '    return new Order();',
      '  }',
      '}',
    ].join('\n'));
    const create = metadata.symbols.find((sym) => sym.name === 'Create');
    assert.equal(create.container, 'OrdersService');
    assert.deepEqual(create.params, [{ name: 'orderId', type: 'string' }]);
    assert.equal(create.returnType, 'Order');
    assert.equal(create.visibility, 'public');
    assert.equal(create.isStatic, true);
    assert.equal(metadata.outline[0].children[0].name, 'Create');
  } finally {
    loaded.restore();
  }
});

test('extractAstMetadata binds Go methods to receiver types via container hint', () => {
  const rootBuilder = () => {
    const typeName = createNode({ type: 'type_identifier', text: 'Server' });
    const typeSpec = createNode({
      type: 'type_spec',
      row: 0,
      endRow: 2,
      fields: {
        name: typeName,
        type: createNode({ type: 'struct_type', text: 'struct{}' }),
      },
    });
    const typeDecl = createNode({
      type: 'type_declaration',
      row: 0,
      endRow: 2,
      children: [typeSpec],
    });
    const methodName = createNode({ type: 'field_identifier', text: 'Handle' });
    const methodDecl = createNode({
      type: 'method_declaration',
      row: 4,
      endRow: 6,
      fields: {
        name: methodName,
        receiver: createNode({ type: 'parameter_list', text: '(s *Server)' }),
      },
    });
    return createNode({ type: 'source_file', children: [typeDecl, methodDecl] });
  };

  const FakeParser = makeParserClass(rootBuilder);
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-go': {},
    },
  });

  try {
    const metadata = mod.extractAstMetadata('cmd/main.go', [
      'type Server struct {}',
      '',
      'func (s *Server) Handle() {}',
    ].join('\n'));

    const handle = metadata.symbols.find((sym) => sym.name === 'Handle');
    assert.equal(handle.container, 'Server');
    assert.equal(handle.containerType, 'class');
    assert.deepEqual(handle.params, []);
    assert.equal(handle.returnType, '');
    assert.equal(metadata.outline[0].name, 'Server');
    assert.equal(metadata.outline[0].children[0].name, 'Handle');
  } finally {
    restore();
  }
});

test('extractEdgesAst extracts unique JS import names from import and require', () => {
  const rootBuilder = () => {
    const idFoo = createNode({ type: 'identifier', text: 'foo' });
    const idBar = createNode({ type: 'identifier', text: 'bar' });
    const idBaz = createNode({ type: 'identifier', text: 'baz' });
    const idNs = createNode({ type: 'identifier', text: 'ns' });
    const idReqB = createNode({ type: 'identifier', text: 'reqB' });

    const importSpecFoo = createNode({
      type: 'import_specifier',
      fields: { name: idFoo },
    });
    const importSpecAlias = createNode({
      type: 'import_specifier',
      fields: { name: idBar, alias: idBaz },
    });
    const namedImports = createNode({
      type: 'named_imports',
      children: [importSpecFoo, importSpecAlias],
    });
    const namespaceImport = createNode({
      type: 'namespace_import',
      fields: { name: idNs },
    });
    const importClause = createNode({
      type: 'import_clause',
      children: [idFoo, namedImports, namespaceImport],
    });
    const importStmt = createNode({
      type: 'import_statement',
      children: [importClause],
    });

    const requireCall = createNode({
      type: 'call_expression',
      fields: {
        function: createNode({ type: 'identifier', text: 'require' }),
      },
    });
    const objPattern = createNode({
      type: 'object_pattern',
      children: [
        createNode({ type: 'shorthand_property_identifier_pattern', text: 'foo' }),
        createNode({
          type: 'pair_pattern',
          fields: { value: idReqB },
        }),
      ],
    });
    const varDecl = createNode({
      type: 'variable_declarator',
      fields: { name: objPattern, value: requireCall },
    });
    const lexical = createNode({
      type: 'lexical_declaration',
      children: [varDecl],
    });

    return createNode({ type: 'program', children: [importStmt, lexical] });
  };
  const FakeParser = makeParserClass(rootBuilder);
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-javascript': {},
    },
  });

  try {
    const knownNames = new Set(['foo', 'baz', 'ns', 'reqB', 'missing']);
    const edges = mod.extractEdgesAst('src/file.js', 'ignored', knownNames);
    assert.equal(Array.isArray(edges), true);

    const names = edges.map((edge) => edge.toSymbol).sort();
    assert.deepEqual(names, ['baz', 'foo', 'ns', 'reqB']);
    assert.equal(edges.filter((edge) => edge.toSymbol === 'foo').length, 1);
    for (const edge of edges) {
      assert.equal(edge.fromFile, 'src/file.js');
      assert.equal(edge.kind, 'import');
    }
  } finally {
    restore();
  }
});

test('extractSymbolsAst and extractEdgesAst return null when parser throws', () => {
  const FakeParser = makeParserClass(() => createNode({ type: 'program' }), { throwOnParse: true });
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-javascript': {},
    },
  });
  try {
    assert.equal(mod.extractSymbolsAst('src/file.js', 'x'), null);
    assert.equal(mod.extractEdgesAst('src/file.js', 'x', new Set(['x'])), null);
  } finally {
    restore();
  }
});

test('extractEdgesAst returns null for languages without import extractor', () => {
  const FakeParser = makeParserClass(() => createNode({ type: 'program' }));
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-java': {},
    },
  });
  try {
    const out = mod.extractEdgesAst('src/Main.java', 'class Main {}', new Set(['Main']));
    assert.equal(out, null);
  } finally {
    restore();
  }
});

test('extractCallEdgesAst resolves same-container Java method calls only when unambiguous', () => {
  const rootBuilder = () => {
    const className = createNode({ type: 'identifier', text: 'OrderService' });
    const createName = createNode({ type: 'identifier', text: 'createOrder' });
    const validateName = createNode({ type: 'identifier', text: 'validateOrder' });
    const callNode = createNode({
      type: 'method_invocation',
      row: 2,
      endRow: 2,
      text: 'validateOrder(order)',
      fields: {
        name: createNode({ type: 'identifier', text: 'validateOrder' }),
      },
    });
    const createMethod = createNode({
      type: 'method_declaration',
      row: 1,
      endRow: 3,
      fields: { name: createName },
      children: [callNode],
    });
    const validateMethod = createNode({
      type: 'method_declaration',
      row: 5,
      endRow: 7,
      fields: { name: validateName },
    });

    return createNode({
      type: 'program',
      children: [
        createNode({
          type: 'class_declaration',
          row: 0,
          endRow: 8,
          fields: { name: className },
          children: [createMethod, validateMethod],
        }),
      ],
    });
  };

  const FakeParser = makeParserClass(rootBuilder);
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-java': {},
    },
  });

  try {
    const content = [
      'class OrderService {',
      '  public void createOrder(Order order) {',
      '    validateOrder(order);',
      '  }',
      '',
      '  private void validateOrder(Order order) {',
      '    return;',
      '  }',
      '}',
    ].join('\n');

    const metadata = mod.extractAstMetadata('src/OrderService.java', content);
    const edges = mod.extractCallEdgesAst('src/OrderService.java', content, metadata.symbols);

    assert.equal(Array.isArray(edges), true);
    assert.equal(edges.length, 1);
    assert.equal(edges[0].fromSymbol, 'createOrder');
    assert.equal(edges[0].toSymbol, 'validateOrder');
    assert.equal(edges[0].kind, 'call');
    assert.equal(edges[0].trust, 'approx-ast');
  } finally {
    restore();
  }
});

test('extractCallEdgesAst skips receiver-based Java calls when the receiver is not a reliable container hint', () => {
  const rootBuilder = () => {
    const serviceName = createNode({ type: 'identifier', text: 'OrderService' });
    const repoName = createNode({ type: 'identifier', text: 'Repo' });
    const processName = createNode({ type: 'identifier', text: 'process' });
    const saveName = createNode({ type: 'identifier', text: 'save' });
    const callNode = createNode({
      type: 'method_invocation',
      row: 2,
      endRow: 2,
      text: 'repo.save()',
      fields: {
        object: createNode({ type: 'identifier', text: 'repo' }),
        name: createNode({ type: 'identifier', text: 'save' }),
      },
    });
    const processMethod = createNode({
      type: 'method_declaration',
      row: 1,
      endRow: 3,
      fields: { name: processName },
      children: [callNode],
    });
    const serviceDecl = createNode({
      type: 'class_declaration',
      row: 0,
      endRow: 4,
      fields: { name: serviceName },
      children: [processMethod],
    });
    const saveMethod = createNode({
      type: 'method_declaration',
      row: 6,
      endRow: 8,
      fields: { name: saveName },
    });
    const repoDecl = createNode({
      type: 'class_declaration',
      row: 5,
      endRow: 9,
      fields: { name: repoName },
      children: [saveMethod],
    });

    return createNode({ type: 'program', children: [serviceDecl, repoDecl] });
  };

  const FakeParser = makeParserClass(rootBuilder);
  const { mod, restore } = loadTreeSitterModule({
    moduleMocks: {
      'tree-sitter': FakeParser,
      'tree-sitter-java': {},
    },
  });

  try {
    const content = [
      'class OrderService {',
      '  void process() {',
      '    repo.save();',
      '  }',
      '}',
      'class Repo {',
      '  void save() {',
      '    return;',
      '  }',
      '}',
    ].join('\n');

    const metadata = mod.extractAstMetadata('src/OrderService.java', content);
    const edges = mod.extractCallEdgesAst('src/OrderService.java', content, metadata.symbols);

    assert.deepEqual(edges, []);
  } finally {
    restore();
  }
});
