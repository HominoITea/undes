const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildCritiqueExpansionAppendix,
  collectMissingSeamsFromApprovalOutputs,
  normalizeMissingSeams,
  parseLineRange,
  resolveMissingSeams,
  shouldTriggerCritiqueExpansion,
} = require('../critique-expansion');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(root, relPath, content) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test('normalizeMissingSeams keeps bounded canonical requests', () => {
  const seams = normalizeMissingSeams([
    { symbolOrSeam: 'processSimpleApproval(...)', reasonNeeded: 'Need real approve body', fetchHint: 'src/flow/ApproverFacadeImpl.java' },
    { symbolOrSeam: 'processSimpleApproval', reasonNeeded: 'duplicate should collapse', fetchHint: 'src/flow/ApproverFacadeImpl.java' },
    { symbolOrSeam: '', reasonNeeded: 'ignored' },
  ], { maxItems: 4 });

  assert.deepEqual(seams, [
    {
      symbolOrSeam: 'processSimpleApproval',
      reasonNeeded: 'Need real approve body',
      expectedImpact: '',
      fetchHint: 'src/flow/ApproverFacadeImpl.java',
    },
  ]);
});

test('normalizeMissingSeams expands broad class requests into method-scoped seams when reason names methods', () => {
  const seams = normalizeMissingSeams([
    {
      symbolOrSeam: 'ApproverFacadeImpl',
      reasonNeeded: 'Need methods processSimpleApproval, processEdsResult, resetApprovalChain for exact approve-path fix',
      fetchHint: 'src/ApproverFacadeImpl.java',
    },
  ], { maxItems: 4 });

  assert.deepEqual(seams.map((item) => item.symbolOrSeam), [
    'ApproverFacadeImpl#processSimpleApproval',
    'ApproverFacadeImpl#processEdsResult',
    'ApproverFacadeImpl#resetApprovalChain',
  ]);
});

test('normalizeMissingSeams splits explicit scoped multi-method requests into separate seams', () => {
  const seams = normalizeMissingSeams([
    {
      symbolOrSeam: 'ApproverFacadeImpl#approveDocument, processSimpleApproval, processEdsResult, moveQueueForward',
      reasonNeeded: 'Need exact approve-path bodies',
      fetchHint: 'src/ApproverFacadeImpl.java',
    },
  ], { maxItems: 5 });

  assert.deepEqual(seams.map((item) => item.symbolOrSeam), [
    'ApproverFacadeImpl#approveDocument',
    'ApproverFacadeImpl#processSimpleApproval',
    'ApproverFacadeImpl#processEdsResult',
    'ApproverFacadeImpl#moveQueueForward',
  ]);
});

test('normalizeMissingSeams expands phrase-based seam labels into method-scoped requests and strips broad range hints', () => {
  const seams = normalizeMissingSeams([
    {
      symbolOrSeam: 'ApproverFacadeImpl queue methods',
      reasonNeeded: 'Need methods moveQueueForward, processApprovalAction, resetApprovalChain for finalization fix',
      fetchHint: 'src/ApproverFacadeImpl.java#L650-L1100',
    },
  ], { maxItems: 4 });

  assert.deepEqual(seams.map((item) => item.symbolOrSeam), [
    'ApproverFacadeImpl#moveQueueForward',
    'ApproverFacadeImpl#processApprovalAction',
    'ApproverFacadeImpl#resetApprovalChain',
  ]);
  assert.ok(seams.every((item) => item.fetchHint === 'src/ApproverFacadeImpl.java'));
});

test('normalizeMissingSeams prioritizes scoped requests over broad symbol seams when capped', () => {
  const seams = normalizeMissingSeams([
    {
      symbolOrSeam: 'ApprovalSettingRepository',
      reasonNeeded: 'Need repository filter semantics',
      fetchHint: 'src/ApprovalSettingRepository.java',
    },
    {
      symbolOrSeam: 'ApproverFacadeImpl queue methods',
      reasonNeeded: 'Need methods moveQueueForward and processApprovalAction for queue fix',
      fetchHint: 'src/ApproverFacadeImpl.java#L650-L1100',
    },
    {
      symbolOrSeam: 'ApproverFacadeImpl#approveDocument',
      reasonNeeded: 'Need direct approval seam',
      fetchHint: 'src/ApproverFacadeImpl.java:416-470',
    },
  ], { maxItems: 3 });

  assert.equal(seams.length, 3);
  assert.ok(seams.every((item) => item.symbolOrSeam.startsWith('ApproverFacadeImpl#')));
  assert.ok(!seams.some((item) => item.symbolOrSeam === 'ApprovalSettingRepository'));
});

test('normalizeMissingSeams dedupes same symbolOrSeam with different fetchHint keeping higher priority', () => {
  const seams = normalizeMissingSeams([
    {
      symbolOrSeam: 'MtfCalculationService#calculate',
      reasonNeeded: 'Reviewer wants body',
      fetchHint: 'src/MtfCalculationService.java',
    },
    {
      symbolOrSeam: 'MtfCalculationService#calculate',
      reasonNeeded: 'Developer wants body',
      fetchHint: 'src/main/java/com/example/MtfCalculationService.java:100-200',
    },
  ]);

  assert.equal(seams.length, 1);
  assert.equal(seams[0].symbolOrSeam, 'MtfCalculationService#calculate');
});

test('normalizeMissingSeams preserves all unique seams without a hard cap', () => {
  const seams = normalizeMissingSeams([
    { symbolOrSeam: 'ServiceA#methodA', reasonNeeded: 'r', fetchHint: 'src/ServiceA' },
    { symbolOrSeam: 'ServiceB#methodB', reasonNeeded: 'r', fetchHint: 'src/ServiceB' },
    { symbolOrSeam: 'ServiceC#methodC', reasonNeeded: 'r', fetchHint: 'src/ServiceC' },
    { symbolOrSeam: 'ServiceD#methodD', reasonNeeded: 'r', fetchHint: 'src/ServiceD' },
    { symbolOrSeam: 'ServiceE#methodE', reasonNeeded: 'r', fetchHint: 'src/ServiceE' },
    { symbolOrSeam: 'ServiceF#methodF', reasonNeeded: 'r', fetchHint: 'src/ServiceF' },
    { symbolOrSeam: 'ServiceG#methodG', reasonNeeded: 'r', fetchHint: 'src/ServiceG' },
    { symbolOrSeam: 'ServiceH#methodH', reasonNeeded: 'r', fetchHint: 'src/ServiceH' },
  ]);

  assert.equal(seams.length, 8);
});

test('collectMissingSeamsFromApprovalOutputs merges and dedupes approval payloads', () => {
  const seams = collectMissingSeamsFromApprovalOutputs([
    {
      approval: {
        missingSeams: [
          { symbolOrSeam: 'processSimpleApproval', reasonNeeded: 'Need body' },
          { symbolOrSeam: 'findByDocumentIdAndApproverUserIdAndIsCurrentInQueueTrue', reasonNeeded: 'Need repository contract' },
        ],
      },
    },
    {
      approval: {
        missingSeams: [
          { symbolOrSeam: 'processSimpleApproval(...)', reasonNeeded: 'Duplicate' },
        ],
      },
    },
  ]);

  assert.deepEqual(seams.map((item) => item.symbolOrSeam), [
    'processSimpleApproval',
    'findByDocumentIdAndApproverUserIdAndIsCurrentInQueueTrue',
  ]);
});

test('parseLineRange supports hash and colon line hints', () => {
  assert.deepEqual(parseLineRange('src/main/App.java#L10-L20'), {
    file: 'src/main/App.java',
    startLine: 10,
    endLine: 20,
  });
  assert.deepEqual(parseLineRange('src/main/App.java:15-18'), {
    file: 'src/main/App.java',
    startLine: 15,
    endLine: 18,
  });
});

test('resolveMissingSeams resolves exact symbol requests deterministically', () => {
  const root = mkTmpDir('critique-expansion-symbol-');
  writeFile(
    root,
    'src/ApproverFacadeImpl.java',
    [
      'class ApproverFacadeImpl {',
      '  void helper() {}',
      '  void processSimpleApproval() {',
      '    approve();',
      '  }',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    { symbolOrSeam: 'processSimpleApproval', reasonNeeded: 'Need approve path body' },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'sym-1',
          name: 'processSimpleApproval',
          type: 'method',
          file: 'src/ApproverFacadeImpl.java',
          startLine: 3,
          endLine: 5,
        },
      ],
    },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].file, 'src/ApproverFacadeImpl.java');
  assert.match(result.fetchedSeams[0].content, /processSimpleApproval/);
  assert.equal(result.skippedSeams.length, 0);
});

test('resolveMissingSeams dedupes duplicate normalized symbol paths before declaring ambiguity', () => {
  const root = mkTmpDir('critique-expansion-dedup-');
  writeFile(
    root,
    'app/_helpers/manhattan.ts',
    [
      'export function buildManhattanRoute() {',
      '  return [];',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'buildManhattanRoute',
      reasonNeeded: 'Need router body',
      fetchHint: 'app/_helpers/manhattan.ts',
    },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'sym-1',
          name: 'buildManhattanRoute',
          type: 'function',
          file: 'app/_helpers/manhattan.ts',
          startLine: 1,
          endLine: 3,
        },
        {
          id: 'sym-2',
          name: 'buildManhattanRoute',
          type: 'function',
          file: './app/_helpers/manhattan.ts',
          startLine: 1,
          endLine: 3,
        },
      ],
    },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.skippedSeams.length, 0);
  assert.equal(result.fetchedSeams[0].file, 'app/_helpers/manhattan.ts');
  assert.match(result.fetchedSeams[0].content, /buildManhattanRoute/);
});

test('resolveMissingSeams resolves Class#method requests through the owner type file', () => {
  const root = mkTmpDir('critique-expansion-scoped-method-');
  writeFile(
    root,
    'src/AbstractDocumentHandler.java',
    [
      'class AbstractDocumentHandler {',
      '  void helper() {}',
      '  void initiateApprovalWorkflow() {',
      '    buildApprovalInstances();',
      '  }',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    { symbolOrSeam: 'AbstractDocumentHandler#initiateApprovalWorkflow', reasonNeeded: 'Need exact mapping seam' },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'class-1',
          name: 'AbstractDocumentHandler',
          type: 'class',
          file: 'src/AbstractDocumentHandler.java',
          startLine: 1,
          endLine: 6,
        },
        {
          id: 'method-1',
          name: 'initiateApprovalWorkflow',
          type: 'method',
          file: 'src/AbstractDocumentHandler.java',
          startLine: 3,
          endLine: 5,
        },
      ],
    },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'scoped-method');
  assert.match(result.fetchedSeams[0].content, /initiateApprovalWorkflow/);
});

test('resolveMissingSeams resolves Class#method via enriched container metadata when owner symbol is absent', () => {
  const root = mkTmpDir('critique-expansion-container-method-');
  writeFile(
    root,
    'src/OrderService.ts',
    [
      'export class OrderService {',
      '  placeOrder() {',
      '    return submitOrder();',
      '  }',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    { symbolOrSeam: 'OrderService#placeOrder', reasonNeeded: 'Need exact order entrypoint' },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'method-1',
          name: 'placeOrder',
          type: 'method',
          file: 'src/OrderService.ts',
          startLine: 2,
          endLine: 4,
          container: 'OrderService',
          containerType: 'class',
        },
      ],
    },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'scoped-method');
  assert.match(result.fetchedSeams[0].content, /placeOrder/);
  assert.equal(result.skippedSeams.length, 0);
});

test('resolveMissingSeams uses container ownership to disambiguate duplicate method names in one file', () => {
  const root = mkTmpDir('critique-expansion-container-disambiguation-');
  writeFile(
    root,
    'src/Services.ts',
    [
      'class BillingService {',
      '  execute() {',
      '    return charge();',
      '  }',
      '}',
      '',
      'class ShippingService {',
      '  execute() {',
      '    return ship();',
      '  }',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'ShippingService#execute',
      reasonNeeded: 'Need shipping execution seam',
      fetchHint: 'src/Services.ts',
    },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'method-1',
          name: 'execute',
          type: 'method',
          file: 'src/Services.ts',
          startLine: 2,
          endLine: 4,
          container: 'BillingService',
          containerType: 'class',
        },
        {
          id: 'method-2',
          name: 'execute',
          type: 'method',
          file: 'src/Services.ts',
          startLine: 8,
          endLine: 10,
          container: 'ShippingService',
          containerType: 'class',
        },
      ],
    },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'scoped-method');
  assert.match(result.fetchedSeams[0].content, /ship/);
  assert.doesNotMatch(result.fetchedSeams[0].content, /charge/);
});

test('resolveMissingSeams falls back to owner class body when method not found in index', () => {
  const root = mkTmpDir('critique-expansion-owner-fallback-');
  writeFile(
    root,
    'src/ApproverFacadeImpl.java',
    [
      'class ApproverFacadeImpl {',
      '  void helper() {}',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'ApproverFacadeImpl#processSimpleApproval',
      reasonNeeded: 'Need exact approve-path body',
      fetchHint: 'src/ApproverFacadeImpl.java',
    },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'class-1',
          name: 'ApproverFacadeImpl',
          type: 'class',
          file: 'src/ApproverFacadeImpl.java',
          startLine: 1,
          endLine: 3,
        },
      ],
    },
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'owner-body-fallback');
  assert.equal(result.fetchedSeams[0].resolvedType, 'owner-class');
  assert.match(result.fetchedSeams[0].content, /helper/);
});

test('resolveMissingSeams rejects bare class-name requests instead of fetching class body', () => {
  const root = mkTmpDir('critique-expansion-bare-class-reject-');
  writeFile(
    root,
    'src/ApproverFacadeImpl.java',
    [
      'class ApproverFacadeImpl {',
      '  void processSimpleApproval() {}',
      '  void helper() {}',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'ApproverFacadeImpl',
      reasonNeeded: 'Need full class',
      fetchHint: 'src/ApproverFacadeImpl.java',
    },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'class-1',
          name: 'ApproverFacadeImpl',
          type: 'class',
          file: 'src/ApproverFacadeImpl.java',
          startLine: 1,
          endLine: 4,
        },
      ],
    },
  });

  assert.equal(result.fetchedSeams.length, 0);
  assert.equal(result.skippedSeams.length, 1);
  assert.match(result.skippedSeams[0].reason, /bare-class-request-rejected/);
});

test('resolveMissingSeams supports exact line-range fetch hints', () => {
  const root = mkTmpDir('critique-expansion-range-');
  writeFile(
    root,
    'src/AbstractDocumentHandler.java',
    [
      'class AbstractDocumentHandler {',
      '  void map() {',
      '    buildApprovalInstances();',
      '  }',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'ApprovalSetting -> ApprovalInstance mapping',
      reasonNeeded: 'Need exact mapping site',
      fetchHint: 'src/AbstractDocumentHandler.java:2-4',
    },
  ], {
    rootDir: root,
    index: { symbols: [] },
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'hint-range');
  assert.match(result.fetchedSeams[0].content, /buildApprovalInstances/);
});

test('resolveMissingSeams treats file path seams as hinted file requests', () => {
  const root = mkTmpDir('critique-expansion-file-primary-');
  writeFile(
    root,
    'app/_helpers/manhattan.ts',
    [
      'export function buildManhattanRoute() {',
      '  return [];',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'app/_helpers/manhattan.ts',
      reasonNeeded: 'Need router file',
    },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'sym-1',
          name: 'buildManhattanRoute',
          type: 'function',
          file: 'app/_helpers/manhattan.ts',
          startLine: 1,
          endLine: 3,
        },
      ],
    },
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'hint-file-primary-symbol');
  assert.match(result.fetchedSeams[0].content, /buildManhattanRoute/);
});

test('resolveMissingSeams can use token search in a hinted file even when the file has no indexed symbols', () => {
  const root = mkTmpDir('critique-expansion-noisy-file-');
  writeFile(
    root,
    'app/board/[boardId]/_components/canvas/canvas.tsx',
    [
      'function moveLayer() {',
      '  const boardId = props.boardId;',
      '  updateConnectedLines();',
      '  scheduleReroute();',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'app/board/[boardId]/_components/canvas/canvas.tsx:перемещение слоя и вызов updateConnectedLines/scheduleReroute',
      reasonNeeded: 'Need exact move path',
      fetchHint: 'Запросить узкий диапазон вокруг updateConnectedLines и scheduleReroute',
    },
  ], {
    rootDir: root,
    index: { symbols: [] },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.skippedSeams.length, 0);
  assert.equal(result.fetchedSeams[0].source, 'hinted-file-token');
  assert.equal(result.fetchedSeams[0].resolvedSymbol, 'updateConnectedLines');
  assert.match(result.fetchedSeams[0].content, /scheduleReroute/);
});

test('resolveMissingSeams prefers scoped method resolution over broad line-range hints', () => {
  const root = mkTmpDir('critique-expansion-scoped-over-range-');
  writeFile(
    root,
    'src/ApproverFacadeImpl.java',
    [
      'class ApproverFacadeImpl {',
      '  void helper() {}',
      '  void approveDocument() {',
      '    stepOne();',
      '  }',
      '  void trailing() {}',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'ApproverFacadeImpl#approveDocument',
      reasonNeeded: 'Need direct approval seam',
      fetchHint: 'src/ApproverFacadeImpl.java:1-7',
    },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'class-1',
          name: 'ApproverFacadeImpl',
          type: 'class',
          file: 'src/ApproverFacadeImpl.java',
          startLine: 1,
          endLine: 7,
        },
        {
          id: 'method-1',
          name: 'approveDocument',
          type: 'method',
          file: 'src/ApproverFacadeImpl.java',
          startLine: 3,
          endLine: 5,
        },
      ],
    },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'scoped-method');
  assert.equal(result.fetchedSeams[0].startLine, 2);
  assert.equal(result.fetchedSeams[0].endLine, 6);
});

test('resolveMissingSeams falls back to a narrow token range for scoped field-like seams', () => {
  const root = mkTmpDir('critique-expansion-token-');
  writeFile(
    root,
    'src/ApprovalInstanceRepository.java',
    [
      'interface ApprovalInstanceRepository {',
      '  Optional<ApprovalInstance> findFirstByDocumentIdAndSequenceNumberGreaterThanOrderBySequenceNumberAsc(UUID documentId, Long sequenceNumber);',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'ApprovalInstanceRepository#sequenceNumber',
      reasonNeeded: 'Need a narrow repository contract seam',
      fetchHint: 'src/ApprovalInstanceRepository.java',
    },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'class-1',
          name: 'ApprovalInstanceRepository',
          type: 'interface',
          file: 'src/ApprovalInstanceRepository.java',
          startLine: 1,
          endLine: 3,
        },
      ],
    },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'scoped-token');
  assert.match(result.fetchedSeams[0].content, /sequenceNumber/);
});

test('resolveMissingSeams normalizes owner labels like entity for scoped token fetches', () => {
  const root = mkTmpDir('critique-expansion-entity-token-');
  writeFile(
    root,
    'src/ApprovalInstance.java',
    [
      'class ApprovalInstance {',
      '  private LocalDateTime approvalDateTime;',
      '}',
      '',
    ].join('\n'),
  );

  const result = resolveMissingSeams([
    {
      symbolOrSeam: 'ApprovalInstance entity#approvalDateTime',
      reasonNeeded: 'Need exact field semantics',
      fetchHint: 'src/ApprovalInstance.java',
    },
  ], {
    rootDir: root,
    index: {
      symbols: [
        {
          id: 'class-1',
          name: 'ApprovalInstance',
          type: 'class',
          file: 'src/ApprovalInstance.java',
          startLine: 1,
          endLine: 3,
        },
      ],
    },
    snippetContextLines: 1,
    maxSnippetLines: 20,
  });

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'scoped-token');
  assert.match(result.fetchedSeams[0].content, /approvalDateTime/);
});

test('resolveMissingSeams falls back to owner class body when method not indexed and token not found', () => {
  const root = mkTmpDir('seam-owner-body-');
  writeFile(root, 'src/dto/ContainerInfo.java', [
    'package dto;',
    '',
    'public class ContainerInfo {',
    '    private Long orderContainerId;',
    '    private String containerType;',
    '',
    '    public Long getOrderContainerId() {',
    '        return orderContainerId;',
    '    }',
    '',
    '    public String getContainerType() {',
    '        return containerType;',
    '    }',
    '}',
  ].join('\n'));

  const index = {
    symbols: [
      // Only the class is indexed, not individual getters/fields
      { name: 'ContainerInfo', type: 'class', file: 'src/dto/ContainerInfo.java', startLine: 3, endLine: 14 },
    ],
  };

  const result = resolveMissingSeams(
    [{ symbolOrSeam: 'ContainerInfo#someUnindexedField', reasonNeeded: 'Need field', fetchHint: 'src/dto/ContainerInfo.java' }],
    { rootDir: root, index },
  );

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'owner-body-fallback');
  assert.equal(result.fetchedSeams[0].resolvedType, 'owner-class');
  assert.match(result.fetchedSeams[0].content, /orderContainerId/);
  assert.match(result.fetchedSeams[0].content, /getContainerType/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('resolveMissingSeams finds getter via field name token variant', () => {
  const root = mkTmpDir('seam-getter-variant-');
  writeFile(root, 'src/service/OrderService.java', [
    'class OrderService {',
    '    private final OrderRepo repo;',
    '',
    '    public Order getEditableOrder(Long id) {',
    '        return repo.findById(id).orElseThrow();',
    '    }',
    '}',
  ].join('\n'));

  const index = {
    symbols: [
      { name: 'OrderService', type: 'class', file: 'src/service/OrderService.java', startLine: 1, endLine: 7 },
    ],
  };

  // Agent requests "editableOrder" (field-style) but code has "getEditableOrder" (getter-style)
  const result = resolveMissingSeams(
    [{ symbolOrSeam: 'OrderService#editableOrder', reasonNeeded: 'Need method', fetchHint: 'src/service/OrderService.java' }],
    { rootDir: root, index },
  );

  assert.equal(result.fetchedSeams.length, 1);
  assert.equal(result.fetchedSeams[0].source, 'scoped-token');
  assert.match(result.fetchedSeams[0].content, /getEditableOrder/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('buildCritiqueExpansionAppendix includes fetched and skipped seams', () => {
  const appendix = buildCritiqueExpansionAppendix({
    requestedSeams: [
      { symbolOrSeam: 'processSimpleApproval', reasonNeeded: 'Need body', expectedImpact: 'Ground guard fix', fetchHint: '' },
    ],
    fetchedSeams: [
      {
        symbolOrSeam: 'processSimpleApproval',
        reasonNeeded: 'Need body',
        expectedImpact: 'Ground guard fix',
        file: 'src/ApproverFacadeImpl.java',
        startLine: 10,
        endLine: 20,
        source: 'symbol',
        content: 'void processSimpleApproval() {}',
      },
    ],
    skippedSeams: [
      { request: { symbolOrSeam: 'PESSIMISTIC_WRITE' }, reason: 'symbol-not-found' },
    ],
  });

  assert.match(appendix, /SEAM EXPANSION — EXPANDED EVIDENCE/);
  assert.match(appendix, /processSimpleApproval/);
  assert.match(appendix, /PESSIMISTIC_WRITE/);
});

test('buildCritiqueExpansionAppendix notes omitted fetched seams and still packs later small blocks', () => {
  const appendix = buildCritiqueExpansionAppendix({
    requestedSeams: [
      { symbolOrSeam: 'firstSeam' },
      { symbolOrSeam: 'hugeSeam' },
      { symbolOrSeam: 'lastSeam' },
    ],
    fetchedSeams: [
      {
        symbolOrSeam: 'firstSeam',
        file: 'src/One.java',
        startLine: 1,
        endLine: 2,
        source: 'symbol',
        content: 'ok',
      },
      {
        symbolOrSeam: 'hugeSeam',
        file: 'src/Huge.java',
        startLine: 1,
        endLine: 80,
        source: 'symbol',
        content: 'x'.repeat(500),
      },
      {
        symbolOrSeam: 'lastSeam',
        file: 'src/Two.java',
        startLine: 4,
        endLine: 5,
        source: 'symbol',
        content: 'tiny',
      },
    ],
    skippedSeams: [],
  }, {
    maxAppendixBytes: 350,
  });

  assert.match(appendix, /firstSeam/);
  assert.match(appendix, /lastSeam/);
  assert.match(appendix, /Appendix byte cap reached/);
  assert.match(appendix, /Omitted fetched seam: hugeSeam/);
});

test('shouldTriggerCritiqueExpansion only fires on substantive assumptions with requests', () => {
  const trigger = shouldTriggerCritiqueExpansion({
    trust: { groundingGapCategories: ['substantive-assumptions'] },
    approvalOutputs: [
      {
        approval: {
          missingSeams: [{ symbolOrSeam: 'processSimpleApproval', reasonNeeded: 'Need body' }],
        },
      },
    ],
  });
  assert.equal(trigger.trigger, true);
  assert.equal(trigger.missingSeams.length, 1);

  const noTrigger = shouldTriggerCritiqueExpansion({
    trust: { groundingGapCategories: ['missing-file-anchor'] },
    approvalOutputs: [
      {
        approval: {
          missingSeams: [{ symbolOrSeam: 'processSimpleApproval', reasonNeeded: 'Need body' }],
        },
      },
    ],
  });
  assert.equal(noTrigger.trigger, false);
});

test('shouldTriggerCritiqueExpansion accepts raw assessFinalResultTrust shape', () => {
  const trigger = shouldTriggerCritiqueExpansion({
    trust: {
      groundingValidation: {
        hasSubstantiveAssumptions: true,
        validationWarnings: [
          '`## Assumptions / Unverified Seams` contains substantive items; patch-safe mode denied.',
        ],
      },
    },
    approvalOutputs: [
      {
        approval: {
          missingSeams: [
            { symbolOrSeam: 'src/flow/ApproverFacadeImpl.java', reasonNeeded: 'Need approve-path body' },
          ],
        },
      },
    ],
  });

  assert.equal(trigger.trigger, true);
  assert.equal(trigger.reason, 'approval-requested-missing-seams');
  assert.equal(trigger.missingSeams.length, 1);
});
