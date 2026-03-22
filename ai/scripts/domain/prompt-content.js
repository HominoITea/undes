const { normalizeMissingSeams } = require('../critique-expansion');
const {
  DEFAULT_EVIDENCE_ALTERNATIVE_PATH_LABEL,
  DEFAULT_HARD_SCOPE_EXAMPLES_LABEL,
  DEFAULT_META_CHATTER_EXAMPLES_LABEL,
} = require('./language-packs/registry');

const END_MARKER = '=== END OF DOCUMENT ===';

function stripEndMarker(content = '', endMarker = END_MARKER) {
  const source = String(content || '');
  const index = source.indexOf(endMarker);
  if (index === -1) return source;
  return source.slice(0, index).trim();
}

function validateEndMarker(content = '', filePath = '', endMarker = END_MARKER) {
  if (!String(content || '').includes(endMarker)) {
    console.warn(`⚠️ WARNING: Missing end marker in ${filePath}`);
    console.warn('   Output may be truncated or incomplete.');
    console.warn(`   Expected marker: ${endMarker}`);
    return false;
  }
  return true;
}

function addLineNumbers(content = '') {
  const lines = String(content || '').split('\n');
  const width = String(lines.length || 1).length;
  return lines
    .map((line, index) => `${String(index + 1).padStart(width, '0')}| ${line}`)
    .join('\n');
}

function buildSameLanguageInstruction(options = {}) {
  const jsonMode = options.jsonMode === true;
  if (jsonMode) {
    return 'The original user prompt above is authoritative for language. Use the same natural language for all free-text string values unless the user explicitly asks for another language. Keep JSON keys, enum values, tables, and required markers exactly as specified.';
  }
  return 'The original user prompt above is authoritative for language. Respond in the same natural language unless the user explicitly asks for another language. Do not switch to English on your own.';
}

function buildGroundedFixesOutputContract() {
  return [
    '## Grounded Fixes',
    '## Assumptions / Unverified Seams',
    '## Assumed Implementation',
    '## Deferred Checks',
    'Every concrete fix, code block, or implementation claim in `Grounded Fixes` must include an `Evidence:` line with file anchors such as `src/File.java` or `src/File.java:123`.',
    'If `Grounded Fixes` proposes implementing a feature, bug fix, endpoint, migration, config change, or test change, include concrete code blocks or unified-diff-style snippets for that change. Do not leave `Grounded Fixes` as recommendation-only prose.',
    'If evidence is insufficient to write grounded code for a change, provide best-effort implementation code in `## Assumed Implementation` with an `Assumption:` line for each code block explaining what evidence is missing. List the uncertain aspect as prose under `Assumptions / Unverified Seams` as well.',
    '`## Assumed Implementation` rules: every code block must have an `Assumption:` line stating what evidence is missing. Code must be realistic and follow project patterns observed in context. Must not duplicate items already in `Grounded Fixes`. Items from `Assumptions / Unverified Seams` that can be expressed as code go here.',
    'Use plain `Evidence:` lines, not markdown-styled variants like `**Evidence:**`.',
    'Only cite exact relative file paths that were shown in the provided context or read during this run. Do not cite unread files, message keys, enum values, or dotted constants as file anchors.',
    `Each cited file anchor must be a single exact path. Do not write alternative paths, guesses, or "${DEFAULT_EVIDENCE_ALTERNATIVE_PATH_LABEL}" variants in \`Evidence:\` lines.`,
    'Do not introduce new repository/service/helper method names or new persistence seams in `Grounded Fixes` unless that exact seam was observed in the provided context or read files.',
    'Do not elevate race conditions, pessimistic locking, or concurrency hardening into `Grounded Fixes` unless the supplied context directly shows a concrete concurrency seam in the affected code path.',
    'If a claim depends on downstream behavior, execution order, side effects, or consumption logic that was not explicitly read in this run, do not place that claim in `Grounded Fixes`.',
    'When the local mechanical defect is proven but downstream behavior remains unread or inferred, keep only the mechanically proven patch in `Grounded Fixes` and move the downstream implication to `Assumptions / Unverified Seams`.',
  ];
}

function buildRoleAwareApprovalGuidance(roleLabel = '') {
  const normalizedRole = String(roleLabel || '').trim().toLowerCase();

  if (normalizedRole.includes('reviewer')) {
    return [
      ' Reviewer focus: judge whether the mechanically proven patch is safe, sufficiently scoped, and useful for the main issue.',
      ' Do not penalize the draft merely because downstream mechanisms remain unverified if those items are clearly isolated under `Assumptions / Unverified Seams`, `Assumed Implementation`, or `Deferred Checks`.',
      ' Penalize the draft if a downstream or unread mechanism is still presented as grounded implementation inside `Grounded Fixes`.',
    ];
  }

  if (normalizedRole.includes('developer')) {
    return [
      ' Developer focus: inspect `Grounded Fixes` for unread seams, guessed file anchors, or downstream mechanism claims that are not directly proven by the supplied context.',
      ' Apply evidence penalties strictly when `Grounded Fixes` relies on inferred execution order, side effects, or consumption logic from files/methods that were not explicitly read in this run.',
      ' Do not downgrade the draft for unresolved downstream ideas when they are correctly quarantined under `Assumptions / Unverified Seams`, `Assumed Implementation`, or `Deferred Checks`.',
    ];
  }

  return [
    ' Use the shared approval baseline: a draft can still pass even when downstream mechanisms remain unverified, as long as those items stay outside `Grounded Fixes` and are clearly labeled as assumptions or follow-up checks.',
  ];
}

function buildNoMetaChatterRules() {
  return [
    'Do not write `RESULT_MODE` or `COPYPASTE_READY`; runtime adds the trust header.',
    ' Do not include internal process notes, log-writing instructions, `.ai/logs/*` paths, or markdown templates for repo logs.',
    ` Do not append meta chatter such as ${DEFAULT_META_CHATTER_EXAMPLES_LABEL}.`,
  ];
}

function buildProposalContent(promptText, discussionSoFar, roleLabel) {
  const discussionBlock = discussionSoFar ? discussionSoFar : 'None yet.';
  return [
    promptText,
    '\n\n---\n\n# WORKSPACE CONTEXT\n',
    discussionBlock,
    '\n\n# YOUR TASK\n',
    `You are acting as ${roleLabel}. Contribute a proposal or improvement. Build on prior ideas if present and avoid repeating them verbatim.`,
    `\n${buildSameLanguageInstruction()}`,
    '\nKeep the response compact: no prompt restatement, no long code dumps, prefer the shortest explanation that still justifies the fix.',
    '\nIf code is needed, include only the smallest grounded patch snippets or changed method/test fragments needed to prove the proposal.',
    '\nDo not emit full classes, full controllers, or exhaustive test files when a focused diff hunk or one method body is enough.',
    '\nWhen making a concrete implementation or code-path claim, add an `Evidence: path[:line]` line that anchors it to the supplied context or read files.',
    '\nIf a concern is plausible but not directly proven, label it explicitly as a hypothesis or unverified seam instead of presenting it as a fact.',
    '\nDo not invent file paths, method names, or blockers just to sound cautious.',
    '\n\n**IMPORTANT:** At the END of your response:',
    '\n1. Add a confidence assessment: `[CONFIDENCE: XX%]` (0-100)',
    '\n2. Add the end marker: `=== END OF DOCUMENT ===`',
    '\n\nConsider: clarity of requirements, technical feasibility, potential edge cases, your expertise in this area.',
  ].join('');
}

function buildCritiqueContentWithProposals(promptText, proposals, runId, roleLabel, currentAgentName) {
  let proposalsBlock = '# PROPOSALS FROM OTHER AGENTS (MUST REVIEW)\n\n';
  proposalsBlock += 'You MUST analyze the proposals below and reference them by file and line number.\n\n';

  for (const proposal of proposals) {
    if (proposal.name === currentAgentName) continue;
    const filePath = `.ai/prompts/runs/${runId}/${proposal.name}-proposal.txt`;
    proposalsBlock += `=== PROPOSAL FROM ${proposal.name} (${filePath}) ===\n`;
    proposalsBlock += addLineNumbers(proposal.text);
    proposalsBlock += '\n=== END PROPOSAL ===\n\n';
  }

  proposalsBlock += `# REQUIRED RESPONSE FORMAT

### Analysis of colleagues' proposals
| Agent | File:line | Verdict | Type | Comment |
|-------|-----------|---------|------|---------|
| example | example-proposal.txt:15 | ✅/❌ | contradiction / unsupported / risk-hypothesis / agree | Reason |

### My additions/objections
[Your critique here]

[CONFIDENCE: XX%]

=== END OF DOCUMENT ===
`;

  return [
    promptText,
    '\n\n---\n\n',
    proposalsBlock,
    '\n\n# YOUR TASK\n',
    `You are acting as ${roleLabel}. Critique the proposals above with specific references. Call out risks and add recommendations.`,
    ` ${buildSameLanguageInstruction()}`,
    ' Be concise and focus only on the highest-impact disagreements or additions.',
    ' For every material objection, label it as exactly one of: `Contradiction`, `Unsupported claim`, or `Risk hypothesis`.',
    ' `Contradiction` means you can directly disprove the claim and must include `Evidence: path[:line]` showing the conflicting code or seam.',
    ' `Unsupported claim` means the other agent did not prove the point; point to the missing evidence or unread/unconfirmed seam instead of pretending it is disproven.',
    ' `Risk hypothesis` is allowed for plausible concerns, but you must say it is not yet proven and must not present it as a confirmed blocker.',
    ' If you agree with a grounded claim, say so briefly rather than inventing a speculative objection.',
    ' If you need extra file reads, request only a narrow range needed to verify one concrete disagreement that is not already grounded in the supplied context or peer proposals.',
    ' Do not broaden into exploratory reading.',
    ' Treat race conditions, pessimistic locking, and concurrency hardening as secondary unless direct code evidence shows concurrent state mutation, missing transactional protection, or another concrete concurrency seam in the affected path.',
  ].join('');
}

function buildConsensusContent(promptText, discussionSoFar, roleLabel) {
  const discussionBlock = discussionSoFar ? discussionSoFar : 'None yet.';
  return [
    promptText,
    '\n\n---\n\n# DISCUSSION SUMMARY\n',
    discussionBlock,
    '\n\n# YOUR TASK\n',
    `You are acting as ${roleLabel}. Produce the final consolidated answer only, integrating the best points from the discussion. Do not include analysis or debate.`,
    ` ${buildSameLanguageInstruction()}`,
    ' Keep it concise and avoid rehashing earlier sections.',
    ' While synthesizing the debate, treat only evidence-backed contradictions as blockers to grounded fixes.',
    ' Do not demote a grounded claim merely because another agent raised an unsupported objection or a plausible risk hypothesis.',
    ' Keep unsupported objections and risk hypotheses under `Assumptions / Unverified Seams` or `Deferred Checks` unless direct evidence later confirms them.',
    ' If two claims conflict, prefer the one backed by direct evidence; if the conflict remains unresolved, describe it as uncertainty rather than guessing.',
    ' Before writing `Grounded Fixes`, classify each implementation claim as either directly proven in this run or still inferred. Only directly proven claims may remain in `Grounded Fixes`.',
    ' Do not place downstream behavior, execution order, side effects, or unread consumption logic in `Grounded Fixes` unless the exact supporting seam was explicitly read in this run.',
    '\n\n# OUTPUT CONTRACT\n',
    'Structure the final answer with these sections in this order:',
    ...buildGroundedFixesOutputContract(),
    'In `Grounded Fixes`, include only fixes or code that are directly supported by files read in this run.',
    'Do not mix assumptions into `Grounded Fixes`.',
    'Put inferred seams, unclear APIs, guessed symbols, and unverified implementation ideas only under `Assumptions / Unverified Seams`.',
    'Always produce implementation code. If evidence is insufficient for `Grounded Fixes`, include best-effort code in `## Assumed Implementation` with an `Assumption:` line for each code block.',
    'If no grounded patch content is available, keep `Grounded Fixes` free of speculative code but ensure `## Assumed Implementation` contains best-effort code for all actionable items.',
    ...buildNoMetaChatterRules(),
    '\n\n**IMPORTANT:** End your response with: `=== END OF DOCUMENT ===`',
  ].join('');
}

function buildConsensusReviewContent(promptText, discussionSoFar, consensusText, roleLabel) {
  const discussionBlock = discussionSoFar ? discussionSoFar : 'None yet.';
  return [
    promptText,
    '\n\n---\n\n# DISCUSSION SUMMARY\n',
    discussionBlock,
    '\n\n# CONSENSUS DRAFT\n',
    consensusText,
    '\n\n# YOUR TASK\n',
    `You are acting as ${roleLabel}. Evaluate the CONSENSUS DRAFT.`,
    ` ${buildSameLanguageInstruction({ jsonMode: true })}`,
    ' Keep notes brief and only mention changes that materially affect correctness, completeness, or evidence quality.',
    ' Review `Grounded Fixes` as proven implementation content, not just as a plausible answer.',
    ' Apply these evidence-quality penalties before setting your final score:',
    ' - `Grounded Fixes` contains concrete claims without `Evidence:` anchors -> subtract 3.',
    ' - `Grounded Fixes` proposes implementation changes but does not include concrete code blocks or diff snippets -> subtract 2.',
    ' - `Grounded Fixes` includes downstream behavior, execution-order, side-effect, or consumption claims that depend on unread seams -> subtract 2.',
    ' - A blocker objection remains unresolved even though the draft/discussion provides no evidence for it -> subtract 2.',
    ' - A risk hypothesis is treated like a proven blocker or code fact instead of staying labeled as uncertainty -> subtract 2.',
    ' - An `Evidence:` anchor points to a missing, guessed, or not-provided file/path -> subtract 1.',
    ' Do not penalize items that are clearly kept under `Assumptions / Unverified Seams`, `Assumed Implementation`, or `Deferred Checks` as unverified follow-up.',
    ' Do not penalize code in `## Assumed Implementation` — it is intentionally best-effort and excluded from trust scoring. Only penalize if assumed code duplicates `Grounded Fixes` items or lacks `Assumption:` labels.',
    ' If `Assumptions / Unverified Seams` or `Deferred Checks` still contain substantive items that look resolvable via narrow file reads, convert them into `missingSeams` requests instead of leaving them as prose-only follow-up.',
    ' A score of 7 or higher does not mean `missingSeams` must be empty; you should still request narrow seams for unresolved but retrievable evidence gaps.',
    ' Prefer surfacing the smallest next reads that would retire the remaining substantive assumptions and move the draft closer to patch-safe.',
    ' If you apply any penalty, explain each one in `notes` with the offending claim, objection, or anchor and the exact required revision.',
    ' If the score drops because the draft still needs direct evidence from a narrow unread seam, you may add `missingSeams` with only the minimal resolvable requests needed for a patch-safe answer.',
    ' `missingSeams` is optional and should stay empty or omitted when the draft can already be approved or revised without additional file reads.',
    ...buildRoleAwareApprovalGuidance(roleLabel),
    ' Shared approval baseline: a draft can still score 7 or higher when downstream mechanisms remain unverified, as long as those claims are removed from `Grounded Fixes` and explicitly quarantined under assumptions/follow-up sections.',
    ' Use the canonical request schema only; do not invent extra fields or an alternative format.',
    ' Every `missingSeams` entry must use `Class#method` format (e.g. `ApproverFacadeImpl#processSimpleApproval`) or an exact line-range hint. Do not request a bare class name — the resolver cannot fetch method bodies from whole-class requests.',
    ' If you need a precise location, prefer a narrow line-range hint such as `src/main/java/.../AbstractDocumentHandler.java:120-165`.',
    ' If the unresolved gap is branch-local, guard-local, or variable-local inside an already known file, keep the request narrow: use the closest known method or file seam and put the exact range or token anchor in `fetchHint`.',
    ' Good `fetchHint` examples: `app/board/.../canvas.tsx:460-520`, `app/board/.../canvas.tsx lines 460-520 around manhattanLockedPrev`, or `src/Flow.java lines 210-250 around fallback branch`.',
    ' When one known file is already enough, prefer file + range/token anchoring over inventing a broader class or service seam.',
    ' Do not request an entire class or file when one method body, one mapping site, or one repository contract is enough.',
    ' Example: if your pre-penalty score is 8 and you found two unresolved evidence problems worth -2 each, your final score should be 4.',
    'Respond strictly with a JSON object (no markdown formatting):',
    '{',
    '  "score": number, // 1-10 final score after evidence-quality penalties',
    '  "notes": "string", // Explain the final score. If penalties apply or score < 7, list specific required changes.',
    '  "missingSeams": [',
    '    {',
    '      "symbolOrSeam": "string",',
    '      "reasonNeeded": "string",',
    '      "expectedImpact": "string",',
    '      "fetchHint": "string"',
    '    }',
    '  ] // optional; include only for narrow unread seams that block a patch-safe answer',
    '}',
    'After the JSON, append the end marker on a new line:',
    `\`${END_MARKER}\``,
    'A score of 7 or higher after penalties implies you AGREE with the draft.',
  ].join('');
}

function buildConsensusRevisionContent(promptText, discussionSoFar, consensusText, revisionNotes) {
  const discussionBlock = discussionSoFar ? discussionSoFar : 'None yet.';
  return [
    promptText,
    '\n\n---\n\n# DISCUSSION SUMMARY\n',
    discussionBlock,
    '\n\n# CURRENT CONSENSUS DRAFT\n',
    consensusText,
    '\n\n# REVISION REQUESTS\n',
    revisionNotes,
    '\n\n# YOUR TASK\n',
    'Revise the consensus draft to address the revision requests above. Produce only the updated final answer, incorporating the feedback while maintaining the strengths of the original draft.',
    ` ${buildSameLanguageInstruction()}`,
    ' Be concise and avoid repeating unchanged sections verbatim.',
    ' Do not remove grounded content solely because a revision request repeats an unsupported objection or a risk hypothesis without direct evidence.',
    ' Keep unsupported objections and still-unproven risks under `Assumptions / Unverified Seams` or `Deferred Checks` unless the revision notes provide direct evidence.',
    ' Reclassify any claim that depends on unread downstream behavior, execution order, side effects, or consumption logic out of `Grounded Fixes` unless the revision notes provide direct evidence for it.',
    ' If revision notes identify a guessed or unread downstream claim inside `Grounded Fixes`, move it to `Assumptions / Unverified Seams` instead of trying to defend it rhetorically.',
    '\n\n# OUTPUT CONTRACT\n',
    'Preserve this structure in the revised final answer:',
    ...buildGroundedFixesOutputContract(),
    'Do not move speculative content into `Grounded Fixes` during revision.',
    'Keep unverified seams and inferred implementation guesses under `Assumptions / Unverified Seams` only.',
    'Do not move assumed code into `Grounded Fixes` during revision unless new evidence was provided. Ensure `## Assumed Implementation` has best-effort code for all unresolved actionable items.',
    ...buildNoMetaChatterRules(),
    '\n\n**IMPORTANT:** End your response with: `=== END OF DOCUMENT ===`',
  ].join('');
}

function buildTextRepairPrompt(phase = 'text-output', stopReason = '') {
  const stopLine = stopReason
    ? `The previous response stopped with provider reason: \`${stopReason}\`.`
    : 'The previous response ended before the required end marker.';

  return [
    '# CONTINUATION TASK',
    stopLine,
    'Continue from the exact point where the previous response stopped.',
    'Do not restart or rewrite the whole answer.',
    'Append only the missing tail needed to finish the document cleanly.',
    'Preserve the existing language of the document; do not translate it unless the user explicitly asked for a language switch.',
    'Do not request files or tools.',
    `This continuation is for phase: ${phase}.`,
    '',
    `Finish with: ${END_MARKER}`,
  ].join('\n');
}

function buildApprovalRepairPrompt(stage = 'approval', stopReason = '') {
  const stopLine = stopReason
    ? `The previous approval response stopped with provider reason: \`${stopReason}\`.`
    : 'The previous approval response did not follow the required JSON contract.';

  return [
    '# APPROVAL JSON REPAIR TASK',
    stopLine,
    'Rewrite your previous approval review into one strict JSON object only.',
    'Do not add markdown, headings, explanations outside the JSON, or code fences.',
    'Preserve the same judgment and requested revisions unless the previous response was internally inconsistent.',
    'Every `missingSeams` entry must use `Class#method` format or an exact line-range hint. Bare class names are rejected by the resolver.',
    'For branch-local or variable-local evidence gaps in an already known file, prefer a file-scoped `fetchHint` such as `app/file.tsx:120-150` or `app/file.tsx lines 120-150 around reroute branch` instead of inventing a broader class/service seam.',
    'Do not request an entire class or file when a narrower seam is enough.',
    '',
    'Required JSON shape:',
    '{',
    '  "score": number,',
    '  "notes": "string",',
    '  "missingSeams": [',
    '    {',
    '      "symbolOrSeam": "string",',
    '      "reasonNeeded": "string",',
    '      "expectedImpact": "string",',
    '      "fetchHint": "string"',
    '    }',
    '  ]',
    '}',
    '',
    `After the JSON, add the end marker on a new line: ${END_MARKER}`,
  ].join('\n');
}

function buildPromptEngineerContent(originalPrompt) {
  return [
    '# ORIGINAL USER PROMPT\n',
    originalPrompt,
    '\n\n---\n\n# YOUR TASK\n',
    "You are a Senior Prompt Engineer. Your job is to analyze and improve the user's prompt before it goes to the development team.",
    `\n${buildSameLanguageInstruction({ jsonMode: true })}`,
    '\n\nAnalyze the prompt and provide an ENHANCED version that:',
    '\n1. **Clarifies ambiguities** - Make vague requirements specific',
    '\n2. **Adds missing context** - What constraints, edge cases, or requirements might the user have forgotten?',
    '\n3. **Structures the request** - Break down complex asks into clear steps',
    '\n4. **Identifies assumptions** - State any assumptions explicitly',
    '\n5. **Suggests acceptance criteria** - What would "done" look like?',
    '\n6. **Detects scope risk** - Tell us when the prompt names narrow files/methods in a way that may accidentally suppress upstream/downstream analysis',
    `\nTreat explicitly listed files/methods/classes as starting seams unless the user clearly says ${DEFAULT_HARD_SCOPE_EXAMPLES_LABEL}, or another explicit hard-scope instruction.`,
    '\nKeep `enhancedPrompt` aligned with the user\'s effective scope. Do not silently broaden an explicit hard scope.',
    '\nIf a broader root-cause variant would improve answer quality, keep `enhancedPrompt` faithful to the current scope and put the optional alternative only into `broadenedPrompt`.',
    '\nKeep analysis brief. Limit suggestedQuestions and assumptions to the most important items only.',
    '\n\nRespond with a JSON object (no markdown formatting):',
    '\n{',
    '\n  "analysis": "Brief analysis of the original prompt (what\'s good, what\'s missing)",',
    '\n  "enhancedPrompt": "The improved, more detailed prompt",',
    '\n  "suggestedQuestions": ["Optional questions to ask the user for more clarity"],',
    '\n  "assumptions": ["List of assumptions made while enhancing"],',
    '\n  "scopeRisk": "none" | "narrow-starting-seams" | "explicit-hard-scope",',
    '\n  "scopeNotes": ["Optional notes about how scope may affect answer quality"],',
    '\n  "broadenedPrompt": "Optional alternative prompt that allows minimal upstream/downstream tracing without changing the task. Leave empty when not needed.",',
    '\n  "complexity": "trivial | standard | complex"',
    '\n}',
    '\n\nComplexity classification guidance:',
    '\n- `trivial`: single-file change, no logic changes — typo fix, rename, config tweak, formatting',
    '\n- `standard`: feature addition, bug fix, moderate scope, 1-3 files affected',
    '\n- `complex`: architectural change, multi-system refactor, requires debate from multiple expert perspectives',
    '\nDefault to `standard` when uncertain.',
    '\n\nAfter the JSON, add the end marker on a new line:',
    `\n${END_MARKER}`,
  ].join('');
}

function normalizeStringList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function normalizePromptScopeRisk(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'narrow-starting-seams' || normalized === 'explicit-hard-scope') {
    return normalized;
  }
  return 'none';
}

const VALID_COMPLEXITIES = ['trivial', 'standard', 'complex'];

function normalizeComplexity(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_COMPLEXITIES.includes(normalized) ? normalized : 'standard';
}

function normalizePromptEngineerResult(payload = {}, fallbackEnhancedPrompt = '') {
  const json = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return {
    analysis: String(json.analysis || '').trim(),
    enhancedPrompt: String(json.enhancedPrompt || fallbackEnhancedPrompt || '').trim() || String(fallbackEnhancedPrompt || ''),
    suggestedQuestions: normalizeStringList(json.suggestedQuestions),
    assumptions: normalizeStringList(json.assumptions),
    scopeRisk: normalizePromptScopeRisk(json.scopeRisk),
    scopeNotes: normalizeStringList(json.scopeNotes),
    broadenedPrompt: String(json.broadenedPrompt || '').trim(),
    complexity: normalizeComplexity(json.complexity),
  };
}

function parsePromptEngineerResponse(responseText) {
  const trimmed = stripEndMarker(responseText).trim().replace(/```json/g, '').replace(/```/g, '');
  try {
    const json = JSON.parse(trimmed);
    return {
      success: true,
      ...normalizePromptEngineerResult(json, responseText),
    };
  } catch {
    return {
      success: false,
      ...normalizePromptEngineerResult({}, responseText),
    };
  }
}

function buildTesterContent(originalPrompt, enhancedPrompt, consensusResult, mode = 'patch-validation') {
  const resolvedMode = mode === 'diagnostic-review' ? 'diagnostic-review' : 'patch-validation';
  const modeInstructions = resolvedMode === 'diagnostic-review'
    ? [
      '\n\nProvide a lightweight diagnostic review:',
      '\n\n1. **Requirement Coverage** - Did the solution cover the user\'s business request end-to-end?',
      '\n2. **Logic Gaps** - What important behavioral or flow gaps remain?',
      '\n3. **Edge Cases** - Which high-value edge cases are still unaddressed?',
      '\n4. **Security Concerns** - Any security implications worth surfacing now?',
      '\n5. **Performance Considerations** - Only mention material performance risks that follow from the described solution.',
      '\n6. **Missing Requirements** - What from the original request is still not satisfied?',
      '\n7. **Code Review Notes** - If grounded code exists, note only the most important issues.',
      '\nDo not expand into exhaustive test matrices or detailed copy-paste test scripts in diagnostic-review mode.',
    ].join('')
    : [
      '\n\nProvide a comprehensive patch-validation analysis:',
      '\n\n1. **Test Cases** - List specific test cases to verify the solution works',
      '\n2. **Edge Cases** - Identify edge cases and boundary conditions',
      '\n3. **Potential Bugs** - What could go wrong? What might break?',
      '\n4. **Security Concerns** - Any security implications?',
      '\n5. **Performance Considerations** - Will this scale? Any bottlenecks?',
      '\n6. **Missing Requirements** - What did the solution miss from the original request?',
      '\n7. **Code Review Notes** - If code is provided, note any issues',
    ].join('');

  return [
    '# ORIGINAL USER REQUEST\n',
    originalPrompt,
    '\n\n# ENHANCED PROMPT (after Prompt Engineer)\n',
    enhancedPrompt,
    '\n\n# PROPOSED SOLUTION\n',
    consensusResult,
    '\n\n---\n\n# YOUR TASK\n',
    'You are a Senior QA Engineer / Tester. Validate the proposed solution thoroughly.',
    `\n${buildSameLanguageInstruction({ jsonMode: true })}`,
    `\n\nTester mode: \`${resolvedMode}\`.`,
    modeInstructions,
    '\nKeep the output economical: list only the most valuable tests/findings and avoid repeating the full solution.',
    '\n\nRespond with a JSON object (no markdown formatting):',
    '\n{',
    '\n  "verdict": "PASS" | "PASS_WITH_NOTES" | "NEEDS_REVISION",',
    '\n  "score": number, // 1-10 overall quality score',
    '\n  "summary": "Brief overall assessment",',
    '\n  "testCases": [{"name": "Test name", "steps": "How to test", "expected": "Expected result"}],',
    '\n  "edgeCases": ["Edge case 1", "Edge case 2"],',
    '\n  "potentialBugs": ["Bug 1", "Bug 2"],',
    '\n  "securityConcerns": ["Concern 1"],',
    '\n  "performanceNotes": ["Note 1"],',
    '\n  "missingRequirements": ["Missing 1"],',
    '\n  "codeReviewNotes": ["Note 1"],',
    '\n  "suggestedImprovements": ["Improvement 1"]',
    '\n}',
    '\n\nAfter the JSON, add the end marker on a new line:',
    `\n${END_MARKER}`,
  ].join('');
}

function parseTesterResponse(responseText) {
  const trimmed = stripEndMarker(responseText).trim().replace(/```json/g, '').replace(/```/g, '');
  try {
    const json = JSON.parse(trimmed);
    return {
      success: true,
      verdict: json.verdict || 'PASS_WITH_NOTES',
      score: json.score || 5,
      summary: json.summary || '',
      testCases: json.testCases || [],
      edgeCases: json.edgeCases || [],
      potentialBugs: json.potentialBugs || [],
      securityConcerns: json.securityConcerns || [],
      performanceNotes: json.performanceNotes || [],
      missingRequirements: json.missingRequirements || [],
      codeReviewNotes: json.codeReviewNotes || [],
      suggestedImprovements: json.suggestedImprovements || [],
    };
  } catch {
    return {
      success: false,
      verdict: 'PASS_WITH_NOTES',
      score: 5,
      summary: responseText,
      testCases: [],
      edgeCases: [],
      potentialBugs: [],
      securityConcerns: [],
      performanceNotes: [],
      missingRequirements: [],
      codeReviewNotes: [],
      suggestedImprovements: [],
    };
  }
}

function parseApproval(responseText) {
  const trimmed = stripEndMarker(responseText).trim().replace(/```json/g, '').replace(/```/g, '');
  try {
    const json = JSON.parse(trimmed);
    const notes = typeof json.notes === 'string' ? json.notes : '';
    const missingSeams = normalizeMissingSeams(json.missingSeams);
    if (typeof json.score === 'number' && Number.isFinite(json.score)) {
      return {
        success: true,
        score: json.score,
        agreed: json.score >= 7,
        notes,
        missingSeams,
      };
    }
    if (typeof json.agreed === 'boolean') {
      return {
        success: true,
        score: typeof json.score === 'number' && Number.isFinite(json.score) ? json.score : null,
        agreed: json.agreed,
        notes,
        missingSeams,
      };
    }
  } catch {
    // fallback below
  }
  return {
    success: false,
    score: null,
    agreed: false,
    notes: trimmed || 'REVISE',
    missingSeams: [],
  };
}

function buildDevilsAdvocateContent(originalPrompt, enhancedPrompt, consensusResult, discussionSoFar) {
  return [
    '# ORIGINAL USER REQUEST\n',
    originalPrompt,
    '\n\n# ENHANCED PROMPT (after Prompt Engineer)\n',
    enhancedPrompt || originalPrompt,
    '\n\n# TEAM DISCUSSION\n',
    discussionSoFar || 'No discussion recorded.',
    '\n\n# PROPOSED SOLUTION (Consensus)\n',
    consensusResult,
    '\n\n---\n\n# YOUR ROLE: DEVIL\'S ADVOCATE\n',
    'Your job is to **actively challenge** the proposed solution. Be adversarial but constructive.',
    `\n${buildSameLanguageInstruction({ jsonMode: true })}`,
    '\n\nYou MUST:',
    '\n1. **Find weaknesses** - What could go wrong? What edge cases are missed?',
    '\n2. **Challenge assumptions** - What assumptions does the solution make that might be wrong?',
    '\n3. **Identify risks** - Security, performance, maintainability, scalability issues',
    '\n4. **Question completeness** - What requirements might not be fully addressed?',
    '\n5. **Suggest attack vectors** - How could this solution fail or be exploited?',
    '\n6. **Check evidence discipline** - In `Grounded Fixes`, flag concrete claims without `Evidence:` anchors, implementation changes described without concrete code blocks/diff snippets, guessed/unread file anchors, or hypotheses presented as proven code facts.',
    '\n7. **Stay calibrated** - Do not treat clearly labeled items under `Assumptions / Unverified Seams` or `Deferred Checks` as defects just because they remain unverified.',
    '\n\nDo NOT be agreeable. Your value is in finding problems others missed.',
    '\nWhen possible, name the exact offending claim, section, or bad anchor in your issue text so revision can fix it directly.',
    '\nIf a concern is only a plausible risk and not directly proven by the provided code/context, say that explicitly instead of overstating it as a confirmed defect.',
    '\n\n**Respond with JSON (no markdown code blocks):**',
    '\n{',
    '\n  "verdict": "APPROVED" | "CONCERNS" | "CRITICAL_ISSUES",',
    '\n  "overallRisk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",',
    '\n  "challengedAssumptions": ["assumption 1", "assumption 2", ...],',
    '\n  "weaknesses": [',
    '\n    { "issue": "description", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "suggestion": "how to fix" }',
    '\n  ],',
    '\n  "edgeCases": ["edge case 1", "edge case 2", ...],',
    '\n  "securityConcerns": ["concern 1", "concern 2", ...],',
    '\n  "missingConsiderations": ["item 1", "item 2", ...],',
    '\n  "summary": "Brief overall assessment"',
    '\n}',
    '\n\nAfter the JSON, add the end marker on a new line:',
    `\n${END_MARKER}`,
  ].join('');
}

function parseDevilsAdvocateResponse(responseText) {
  const trimmed = stripEndMarker(responseText).trim().replace(/```json/g, '').replace(/```/g, '');
  try {
    const json = JSON.parse(trimmed);
    return {
      success: true,
      verdict: json.verdict || 'CONCERNS',
      overallRisk: json.overallRisk || 'MEDIUM',
      challengedAssumptions: json.challengedAssumptions || [],
      weaknesses: json.weaknesses || [],
      edgeCases: json.edgeCases || [],
      securityConcerns: json.securityConcerns || [],
      missingConsiderations: json.missingConsiderations || [],
      summary: json.summary || '',
    };
  } catch {
    return {
      success: false,
      verdict: 'CONCERNS',
      overallRisk: 'MEDIUM',
      challengedAssumptions: [],
      weaknesses: [],
      edgeCases: [],
      securityConcerns: [],
      missingConsiderations: [],
      summary: responseText,
    };
  }
}

module.exports = {
  END_MARKER,
  stripEndMarker,
  validateEndMarker,
  addLineNumbers,
  buildProposalContent,
  buildCritiqueContentWithProposals,
  buildConsensusContent,
  buildConsensusReviewContent,
  buildConsensusRevisionContent,
  buildTextRepairPrompt,
  buildApprovalRepairPrompt,
  buildPromptEngineerContent,
  VALID_COMPLEXITIES,
  normalizeComplexity,
  normalizePromptEngineerResult,
  parsePromptEngineerResponse,
  buildTesterContent,
  parseTesterResponse,
  parseApproval,
  buildDevilsAdvocateContent,
  parseDevilsAdvocateResponse,
};
