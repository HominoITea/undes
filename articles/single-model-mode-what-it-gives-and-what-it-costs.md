# Single-Model Mode: What It Gives, and What It Costs

By default, Undes runs a structured workflow across **different** models. One
model proposes, another critiques, a third synthesizes. That diversity is not a
detail — it is the main reason a multi-agent answer is worth more than a single
prompt. The model that reviews the work is not the model that produced it, so its
blind spots are different.

Single-model mode deliberately turns that off. Every role runs on **one** model.

```sh
undes run --prompt="..." --model=gpt-5.4
undes run --prompt="..." --model=qwen3:8b --provider=openai-compatible
```

It is available in every edition. This article explains what you gain, what you
give up, and how Undes stays honest about the difference.

## What it gives you

- **One model, one key.** No need to configure and fund several providers. Useful
  when you only have access to one — a single OpenRouter key, or a local model
  and nothing else.
- **Lower cost.** One model instead of several across the phases.
- **Simpler and faster to start.** Good for drafts, exploration, quick iteration,
  and cost-sensitive runs where you do not need the full trust posture.
- **Local-only runs.** Combined with a local provider and `UNDES_NO_NETWORK=1`,
  you can run the whole workflow without anything leaving your machine.

## What it costs

Single-model mode keeps the structured phases — preprocess, proposal, critique,
approval, synthesis — but the same model plays every part. That removes the
**cross-model check**.

When one model both writes the proposal and reviews it, a mistake it is confident
about tends to survive: the reviewer shares the author's blind spots, because it
*is* the author. You still get the discipline of the workflow, but not an
independent second opinion.

So the trust ordering is:

> **cross-model** (distinct models per role) **>** **single-model** (one model,
> full workflow) **>** **single-pass** (one prompt, no workflow).

Single-model mode is better than asking a model once. It is weaker than running
the workflow with real model diversity.

## Undes does not hide the difference

The result of a run carries its own trust signals, and single-model mode is one
of them. The run records whether **cross-model verification** actually
happened — that is, whether two or more distinct models took part. In
single-model mode it did not, and the receipt says so plainly. You are never
shown a "verified by multiple models" claim that did not happen.

If you want the verdict itself to reflect the weaker posture, opt into strict
single-model handling:

```sh
undes run --prompt="..." --model=gpt-5.4 --single-model-strict
```

or set `UNDES_SINGLE_MODEL_STRICT=1`, or `pipelinePolicy.singleModelVerdictDowngrade: true`
in your config. With it on, a run that had no cross-model verification has its
verdict downgraded a tier — so a single-model answer is never presented with the
same confidence as a cross-checked one. It is off by default: the receipt is
always honest, but the downgrade is your choice.

## When to use which

Use **single-model mode** for:

- drafts, exploration, and throwaway iteration;
- cost-sensitive or rate-limited situations;
- a setup with only one provider, or a local-only / no-network run;
- quick checks where you will review the output yourself anyway.

Use the **default multi-model setup** for:

- changes you intend to ship;
- anything where you will trust the final answer without re-reviewing it;
- high-stakes or trust-critical work.

## Summary

Single-model mode trades the cross-model check for simplicity, cost, and the
ability to run on one model — including a local one. It keeps the workflow, drops
the independent reviewer, and tells you it did. Reach for it when the stakes are
low or the constraints are real; reach for distinct models per role when the
answer has to stand on its own.
