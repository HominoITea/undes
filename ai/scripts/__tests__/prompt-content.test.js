const test = require('node:test');
const assert = require('node:assert/strict');

const {
  END_MARKER,
  stripEndMarker,
  validateEndMarker,
  buildProposalContent,
  buildCritiqueContentWithProposals,
  buildConsensusContent,
  buildConsensusReviewContent,
  buildConsensusRevisionContent,
  buildApprovalRepairPrompt,
  buildPromptEngineerContent,
  buildTesterContent,
  parsePromptEngineerResponse,
  parseTesterResponse,
  parseApproval,
  buildDevilsAdvocateContent,
  parseDevilsAdvocateResponse,
} = require('../domain/prompt-content');

test('stripEndMarker removes trailing marker block', () => {
  const input = `hello world\n${END_MARKER}\nextra`;
  assert.equal(stripEndMarker(input), 'hello world');
  assert.equal(stripEndMarker('plain text'), 'plain text');
});

test('validateEndMarker validates presence', () => {
  assert.equal(validateEndMarker(`text\n${END_MARKER}`, 'x.txt'), true);
  assert.equal(validateEndMarker('text only', 'x.txt'), false);
});

test('buildCritiqueContentWithProposals skips own proposal and adds numbered peers', () => {
  const text = buildCritiqueContentWithProposals(
    'prompt',
    [
      { name: 'architect', text: 'A\nB' },
      { name: 'reviewer', text: 'R' },
    ],
    '2026-03-03T00-00-00-000Z',
    'Reviewer',
    'reviewer',
  );

  assert.match(text, /PROPOSAL FROM architect/);
  assert.doesNotMatch(text, /PROPOSAL FROM reviewer/);
  assert.match(text, /1\| A/);
  assert.match(text, /\| Agent \| File:line \| Verdict \| Type \| Comment \|/);
  assert.match(text, /contradiction \/ unsupported \/ risk-hypothesis \/ agree/);
  assert.match(text, /=== END OF DOCUMENT ===/);
  assert.match(text, /For every material objection, label it as exactly one of: `Contradiction`, `Unsupported claim`, or `Risk hypothesis`/);
  assert.match(text, /`Contradiction` means you can directly disprove the claim and must include `Evidence: path\[:line\]`/);
  assert.match(text, /`Unsupported claim` means the other agent did not prove the point/);
  assert.match(text, /`Risk hypothesis` is allowed for plausible concerns, but you must say it is not yet proven/);
  assert.match(text, /If you need extra file reads, request only a narrow range/);
  assert.match(text, /Treat race conditions, pessimistic locking, and concurrency hardening as secondary/);
});

test('proposal prompt requires evidence for concrete claims and labels hypotheses honestly', () => {
  const proposal = buildProposalContent('prompt', 'discussion', 'Developer');

  assert.match(proposal, /When making a concrete implementation or code-path claim, add an `Evidence: path\[:line\]` line/);
  assert.match(proposal, /include only the smallest grounded patch snippets or changed method\/test fragments/);
  assert.match(proposal, /Do not emit full classes, full controllers, or exhaustive test files/);
  assert.match(proposal, /If a concern is plausible but not directly proven, label it explicitly as a hypothesis or unverified seam/);
  assert.match(proposal, /Do not invent file paths, method names, or blockers just to sound cautious/);
});

test('all user-facing prompt builders enforce same-language behavior', () => {
  const proposal = buildProposalContent('пользовательский запрос', 'discussion', 'Developer');
  const critique = buildCritiqueContentWithProposals('пользовательский запрос', [], 'run-1', 'Reviewer', 'reviewer');
  const consensus = buildConsensusContent('пользовательский запрос', 'discussion', 'Synthesizer');
  const review = buildConsensusReviewContent('пользовательский запрос', 'discussion', 'draft', 'Reviewer');
  const revision = buildConsensusRevisionContent('пользовательский запрос', 'discussion', 'draft', 'notes');
  const promptEngineer = buildPromptEngineerContent('пользовательский запрос');
  const tester = buildTesterContent('пользовательский запрос', 'enhanced', 'consensus');
  const devilsAdvocate = buildDevilsAdvocateContent('пользовательский запрос', 'enhanced', 'consensus', 'discussion');

  for (const text of [proposal, critique, consensus, review, revision, promptEngineer, tester, devilsAdvocate]) {
    assert.match(text, /The original user prompt above is authoritative for language\./);
  }
  assert.match(review, /Use the same natural language for all free-text string values/);
  assert.match(tester, /Keep JSON keys, enum values, tables, and required markers exactly as specified/);
});

test('consensus prompts explicitly forbid internal log templates and meta chatter', () => {
  const consensus = buildConsensusContent('prompt', 'discussion', 'Synthesizer');
  const revision = buildConsensusRevisionContent('prompt', 'discussion', 'draft', 'notes');

  assert.match(consensus, /## Grounded Fixes/);
  assert.match(consensus, /## Assumptions \/ Unverified Seams/);
  assert.match(consensus, /## Assumed Implementation/);
  assert.match(consensus, /## Deferred Checks/);
  assert.match(consensus, /Always produce implementation code/);
  assert.match(consensus, /While synthesizing the debate, treat only evidence-backed contradictions as blockers to grounded fixes/);
  assert.match(consensus, /Do not demote a grounded claim merely because another agent raised an unsupported objection or a plausible risk hypothesis/);
  assert.match(consensus, /Keep unsupported objections and risk hypotheses under `Assumptions \/ Unverified Seams` or `Deferred Checks` unless direct evidence later confirms them/);
  assert.match(consensus, /Every concrete fix, code block, or implementation claim in `Grounded Fixes` must include an `Evidence:` line/);
  assert.match(consensus, /include concrete code blocks or unified-diff-style snippets/);
  assert.match(consensus, /Do not leave `Grounded Fixes` as recommendation-only prose/);
  assert.match(consensus, /Use plain `Evidence:` lines, not markdown-styled variants like `\*\*Evidence:\*\*`/);
  assert.match(consensus, /Do not cite unread files, message keys, enum values, or dotted constants as file anchors/);
  assert.match(consensus, /Do not write alternative paths, guesses, or "or\/или" variants in `Evidence:` lines/);
  assert.match(consensus, /Do not introduce new repository\/service\/helper method names or new persistence seams in `Grounded Fixes` unless that exact seam was observed/);
  assert.match(consensus, /Do not elevate race conditions, pessimistic locking, or concurrency hardening into `Grounded Fixes` unless the supplied context directly shows a concrete concurrency seam/);
  assert.match(consensus, /If a claim depends on downstream behavior, execution order, side effects, or consumption logic that was not explicitly read in this run, do not place that claim in `Grounded Fixes`/);
  assert.match(consensus, /Before writing `Grounded Fixes`, classify each implementation claim as either directly proven in this run or still inferred/);
  assert.match(consensus, /Do not place downstream behavior, execution order, side effects, or unread consumption logic in `Grounded Fixes` unless the exact supporting seam was explicitly read in this run/);
  assert.match(consensus, /Do not write `RESULT_MODE` or `COPYPASTE_READY`/);
  assert.match(consensus, /Do not include internal process notes, log-writing instructions/);
  assert.match(consensus, /Do not append meta chatter/);
  assert.match(revision, /## Grounded Fixes/);
  assert.match(revision, /## Assumptions \/ Unverified Seams/);
  assert.match(revision, /## Assumed Implementation/);
  assert.match(revision, /## Deferred Checks/);
  assert.match(revision, /Do not move assumed code into `Grounded Fixes` during revision unless new evidence was provided/);
  assert.match(revision, /Do not remove grounded content solely because a revision request repeats an unsupported objection or a risk hypothesis without direct evidence/);
  assert.match(revision, /Keep unsupported objections and still-unproven risks under `Assumptions \/ Unverified Seams` or `Deferred Checks` unless the revision notes provide direct evidence/);
  assert.match(revision, /Do not write `RESULT_MODE` or `COPYPASTE_READY`/);
  assert.match(revision, /Do not cite unread files, message keys, enum values, or dotted constants as file anchors/);
  assert.match(revision, /Do not write alternative paths, guesses, or "or\/или" variants in `Evidence:` lines/);
  assert.match(revision, /Do not introduce new repository\/service\/helper method names or new persistence seams in `Grounded Fixes` unless that exact seam was observed/);
  assert.match(revision, /Use plain `Evidence:` lines, not markdown-styled variants like `\*\*Evidence:\*\*`/);
  assert.match(revision, /Do not elevate race conditions, pessimistic locking, or concurrency hardening into `Grounded Fixes` unless the supplied context directly shows a concrete concurrency seam/);
  assert.match(revision, /Reclassify any claim that depends on unread downstream behavior, execution order, side effects, or consumption logic out of `Grounded Fixes` unless the revision notes provide direct evidence for it/);
  assert.match(revision, /If revision notes identify a guessed or unread downstream claim inside `Grounded Fixes`, move it to `Assumptions \/ Unverified Seams` instead of trying to defend it rhetorically/);
  assert.match(revision, /Do not include internal process notes, log-writing instructions/);
  assert.match(revision, /Do not append meta chatter/);
});

test('approval review prompt applies evidence-quality penalties before agreeing', () => {
  const review = buildConsensusReviewContent('prompt', 'discussion', 'draft', 'Reviewer');

  assert.match(review, /Keep notes brief and only mention changes that materially affect correctness, completeness, or evidence quality/);
  assert.match(review, /Review `Grounded Fixes` as proven implementation content/);
  assert.match(review, /`Grounded Fixes` contains concrete claims without `Evidence:` anchors -> subtract 3/);
  assert.match(review, /`Grounded Fixes` proposes implementation changes but does not include concrete code blocks or diff snippets -> subtract 2/);
  assert.match(review, /`Grounded Fixes` includes downstream behavior, execution-order, side-effect, or consumption claims that depend on unread seams -> subtract 2/);
  assert.match(review, /A blocker objection remains unresolved even though the draft\/discussion provides no evidence for it -> subtract 2/);
  assert.match(review, /A risk hypothesis is treated like a proven blocker or code fact instead of staying labeled as uncertainty -> subtract 2/);
  assert.match(review, /An `Evidence:` anchor points to a missing, guessed, or not-provided file\/path -> subtract 1/);
  assert.match(review, /Do not penalize items that are clearly kept under `Assumptions \/ Unverified Seams`, `Assumed Implementation`, or `Deferred Checks`/);
  assert.match(review, /Do not penalize code in `## Assumed Implementation`/);
  assert.match(review, /convert them into `missingSeams` requests instead of leaving them as prose-only follow-up/);
  assert.match(review, /A score of 7 or higher does not mean `missingSeams` must be empty/);
  assert.match(review, /Prefer surfacing the smallest next reads that would retire the remaining substantive assumptions/);
  assert.match(review, /If you apply any penalty, explain each one in `notes`/);
  assert.match(review, /A score of 7 or higher after penalties implies you AGREE with the draft/);
  assert.match(review, /Reviewer focus: judge whether the mechanically proven patch is safe, sufficiently scoped, and useful for the main issue/);
  assert.match(review, /Shared approval baseline: a draft can still score 7 or higher when downstream mechanisms remain unverified/);
  assert.match(review, /missingSeams/);
  assert.match(review, /minimal resolvable requests needed for a patch-safe answer/);
  assert.match(review, /Every `missingSeams` entry must use `Class#method` format/);
  assert.match(review, /Do not request an entire class or file when one method body/);
});

test('approval review prompt is role-aware but keeps one approval baseline', () => {
  const reviewerPrompt = buildConsensusReviewContent('prompt', 'discussion', 'draft', 'Reviewer');
  const developerPrompt = buildConsensusReviewContent('prompt', 'discussion', 'draft', 'Developer');

  assert.match(reviewerPrompt, /Reviewer focus: judge whether the mechanically proven patch is safe, sufficiently scoped, and useful for the main issue/);
  assert.match(reviewerPrompt, /Do not penalize the draft merely because downstream mechanisms remain unverified if those items are clearly isolated/);
  assert.match(developerPrompt, /Developer focus: inspect `Grounded Fixes` for unread seams, guessed file anchors, or downstream mechanism claims/);
  assert.match(developerPrompt, /Apply evidence penalties strictly when `Grounded Fixes` relies on inferred execution order, side effects, or consumption logic/);
  assert.match(developerPrompt, /Do not downgrade the draft for unresolved downstream ideas when they are correctly quarantined/);
  assert.match(reviewerPrompt, /Shared approval baseline: a draft can still score 7 or higher when downstream mechanisms remain unverified/);
  assert.match(developerPrompt, /Shared approval baseline: a draft can still score 7 or higher when downstream mechanisms remain unverified/);
});

test('approval repair prompt reinforces strict JSON and narrow seam requests', () => {
  const repair = buildApprovalRepairPrompt('approval-1', 'STOP');

  assert.match(repair, /APPROVAL JSON REPAIR TASK/);
  assert.match(repair, /strict JSON object only/);
  assert.match(repair, /Do not add markdown, headings, explanations outside the JSON/);
  assert.match(repair, /Every `missingSeams` entry must use `Class#method` format/);
  assert.match(repair, /Do not request an entire class or file when a narrower seam is enough/);
});

test('devils advocate prompt checks evidence discipline without over-penalizing labeled assumptions', () => {
  const devilsAdvocate = buildDevilsAdvocateContent('prompt', 'enhanced', 'consensus', 'discussion');

  assert.match(devilsAdvocate, /Check evidence discipline/);
  assert.match(devilsAdvocate, /flag concrete claims without `Evidence:` anchors, implementation changes described without concrete code blocks\/diff snippets, guessed\/unread file anchors, or hypotheses presented as proven code facts/);
  assert.match(devilsAdvocate, /Do not treat clearly labeled items under `Assumptions \/ Unverified Seams` or `Deferred Checks` as defects/);
  assert.match(devilsAdvocate, /name the exact offending claim, section, or bad anchor/);
  assert.match(devilsAdvocate, /If a concern is only a plausible risk and not directly proven by the provided code\/context, say that explicitly/);
});

test('parsePromptEngineerResponse parses json and fallback', () => {
  const ok = parsePromptEngineerResponse(
    '{"analysis":"a","enhancedPrompt":"b","suggestedQuestions":["q"],"assumptions":["s"],"scopeRisk":"narrow-starting-seams","scopeNotes":["Prompt pins only one method"],"broadenedPrompt":"start here but trace upstream"}\n=== END OF DOCUMENT ===',
  );
  assert.equal(ok.success, true);
  assert.equal(ok.enhancedPrompt, 'b');
  assert.deepEqual(ok.suggestedQuestions, ['q']);
  assert.equal(ok.scopeRisk, 'narrow-starting-seams');
  assert.deepEqual(ok.scopeNotes, ['Prompt pins only one method']);
  assert.equal(ok.broadenedPrompt, 'start here but trace upstream');

  const bad = parsePromptEngineerResponse('not-json');
  assert.equal(bad.success, false);
  assert.equal(bad.enhancedPrompt, 'not-json');
  assert.equal(bad.scopeRisk, 'none');
  assert.deepEqual(bad.scopeNotes, []);
  assert.equal(bad.broadenedPrompt, '');
});

test('prompt engineer prompt requests scope-risk assessment without silently broadening hard scope', () => {
  const prompt = buildPromptEngineerContent('Investigate only ApproverFacadeImpl#approveDocument');

  assert.match(prompt, /Detects scope risk/);
  assert.match(prompt, /Treat explicitly listed files\/methods\/classes as starting seams unless the user clearly says/);
  assert.match(prompt, /Do not silently broaden an explicit hard scope/);
  assert.match(prompt, /"scopeRisk": "none" \| "narrow-starting-seams" \| "explicit-hard-scope"/);
  assert.match(prompt, /"scopeNotes": \["Optional notes about how scope may affect answer quality"\]/);
  assert.match(prompt, /"broadenedPrompt": "Optional alternative prompt that allows minimal upstream\/downstream tracing/);
});

test('parseTesterResponse returns defaults on invalid payload', () => {
  const ok = parseTesterResponse('{"verdict":"PASS","score":9}\n=== END OF DOCUMENT ===');
  assert.equal(ok.success, true);
  assert.equal(ok.verdict, 'PASS');
  assert.equal(ok.score, 9);

  const bad = parseTesterResponse('bad-json');
  assert.equal(bad.success, false);
  assert.equal(bad.verdict, 'PASS_WITH_NOTES');
});

test('buildTesterContent switches between patch-validation and diagnostic-review modes', () => {
  const patchValidation = buildTesterContent('prompt', 'enhanced', 'consensus', 'patch-validation');
  const diagnosticReview = buildTesterContent('prompt', 'enhanced', 'consensus', 'diagnostic-review');

  assert.match(patchValidation, /Tester mode: `patch-validation`/);
  assert.match(patchValidation, /Provide a comprehensive patch-validation analysis/);
  assert.match(patchValidation, /List specific test cases to verify the solution works/);

  assert.match(diagnosticReview, /Tester mode: `diagnostic-review`/);
  assert.match(diagnosticReview, /Provide a lightweight diagnostic review/);
  assert.match(diagnosticReview, /Did the solution cover the user's business request end-to-end/);
  assert.match(diagnosticReview, /Do not expand into exhaustive test matrices/);
});

test('parseApproval parses score and fallback text mode', () => {
  const agreed = parseApproval('{"score":8,"notes":"ok","missingSeams":[{"symbolOrSeam":"processSimpleApproval(...)","reasonNeeded":"Need body"}]}\n=== END OF DOCUMENT ===');
  assert.deepEqual(agreed, {
    success: true,
    score: 8,
    agreed: true,
    notes: 'ok',
    missingSeams: [
      {
        symbolOrSeam: 'processSimpleApproval',
        reasonNeeded: 'Need body',
        expectedImpact: '',
        fetchHint: '',
      },
    ],
  });

  const disagree = parseApproval('REVISE: add tests');
  assert.equal(disagree.success, false);
  assert.equal(disagree.agreed, false);
  assert.match(disagree.notes, /REVISE/);
  assert.deepEqual(disagree.missingSeams, []);
});

test('parseDevilsAdvocateResponse parses json and fallback', () => {
  const ok = parseDevilsAdvocateResponse('{"verdict":"APPROVED","overallRisk":"LOW"}\n=== END OF DOCUMENT ===');
  assert.equal(ok.success, true);
  assert.equal(ok.verdict, 'APPROVED');

  const bad = parseDevilsAdvocateResponse('no-json');
  assert.equal(bad.success, false);
  assert.equal(bad.verdict, 'CONCERNS');
});
