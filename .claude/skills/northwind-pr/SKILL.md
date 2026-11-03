---
name: northwind-pr
description: Write a pull request title and description in the Northwind team's required format (title, What changed, How I verified it, Acceptance criteria, Deliberately not done) from the branch diff, git log, and ticket. Use when the user asks to write, draft, or update a PR description for a Northwind ticket, invokes /northwind-pr, or when /submit needs a PR body.
---

# /northwind-pr

Write the pull request title and description for the work on the current branch, in the team's format.

A reviewer reads the description before the diff. Its job is to tell them, in thirty seconds, what the change does, how we know it works, and what it deliberately leaves alone. Every claim in it must be something the reviewer could check and find true.

## 1. Gather the facts first

Do all of this before writing a word of the description.

1. **Ticket ID.** Take it from the branch name: `NWP-101-export-options` → `NWP-101`. If the branch name has no ticket ID, ask the user which ticket this is. Do not guess.
2. **Ticket.** Read `docs/tickets/<TICKET-ID>.md`. Copy the acceptance criteria exactly as written; they become the checkboxes. If the file does not exist, stop and tell the user.
3. **Commits.** `git log main..HEAD --oneline`: how the work was sequenced.
4. **Diff.** `git diff main...HEAD --stat`, then the full diff. Read the diff itself, not just the file list: you need to know what each change does to say whether a criterion is met.
5. **Spec.** If `docs/specs/` has a plan for this ticket, read it and note anywhere the build departed from it.
6. **Verification evidence.** Collect what was actually run, from two sources only:
   - commands run in this session, with their real output;
   - checks the user tells you they did themselves, such as clicking through a page.

   If the tests have not been run on the current state of the branch, run them now (`npm test` in `build-battle/merchant-console/`) and use that output. Do not run anything that changes files, pushes, or opens a PR.

## 2. Write the description

### Title

`<TICKET-ID>: <what it does>`, in lower case after the colon, as a plain verb phrase. For example: `NWP-101: add export options for columns and scope`.

### What changed

One paragraph in plain language. Describe what someone can do now that they could not do before, and anything that now behaves differently. This is not a file list; the diff already is one.

- Good: "The Export button now opens a panel where ops pick columns and scope. Card last four is off by default."
- Bad: "Updated `csv.ts`, `route.ts`, and `page.tsx`. Implemented export options functionality."

### How I verified it

The commands that were run and what they printed. Quote the real output, such as the test summary line, a status code, or a header. For a check the user did by hand, name what they checked using their own words.

- Good: "`npm test`: 36 passed (36), including the empty-selection case."
- Good: "`curl '/api/payments/export?columns=pan'`: 400 `{"error":"Unknown export column: pan"}`."
- Bad: "Tests pass." "Verified manually." "Should work in the browser."

If something was not verified, say so in this section: "Not checked in a browser." Leaving it out reads as a claim that it was checked.

### Acceptance criteria

The ticket's criteria as checkboxes, word for word, in the ticket's order.

- Tick a criterion only if you can point to the code that meets it. Intending to meet it doesn't count.
- If it is partly met, leave it unticked, add `(partial)`, and say which part is done and which is not.
- If the code meets it but it has not been verified, tick it and add a note saying it is untested.
- An unmet criterion stated plainly is fine. An unmet criterion that is ticked or left unmentioned is not.

### Deliberately not done

Anything left out on purpose: work outside the ticket's scope, follow-ups, problems found but not fixed, and tests you meant to write. Give each one a line saying what it is and, where relevant, the file. If there is genuinely nothing, write "Nothing."

## 3. Hand it over

1. Write the title and body to a file in the scratchpad directory.
2. Print both in the conversation.
3. Offer the next step: `/submit`, or `gh pr create --title "<title>" --body-file <file>`, or `gh pr edit <n> --body-file <file>` for an existing PR. Ask first. Pushing and opening or editing a pull request are the user's decision.

## Rules

- **Never claim a verification step that was not run.** This rule overrides everything else in this file. If a command was not run in this session and the user did not tell you they did it, it does not appear as done. Do not infer results ("the tests would pass") and do not add detail to what the user reported. If they said "I checked the dialog", write that, not a list of things they might have seen.
- **Read before writing.** No description until the ticket, log, and diff have been read.
- **Copy acceptance criteria exactly.** Do not reword, merge, or drop any.
- **Plain language.** Describe behavior, not implementation ceremony.
- **No placeholders.** Every section is filled in, or explicitly says "Nothing" or "Not verified".
- **Never push, open, edit, or merge a pull request** without the user's go-ahead in the conversation.
