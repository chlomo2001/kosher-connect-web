# Usability testing — the script, the questionnaires, and the arithmetic

**Written 27 August 2026.** Everything in the quality programme so far was
measured from a keyboard: contrast ratios, target sizes, heading order, Core Web
Vitals, Nielsen's ten. All of that finds **violations**. None of it finds
**friction** — the step that is technically correct and still costs four seconds
every single time, forty times a day.

This is the instrument for that. It needs people, and it is deliberately short:
about **25 minutes per person**, five people, one afternoon.

---

## Who, and how many

**Five participants.** Beyond five the same problems start repeating; the sixth
person mostly confirms the first five. Aim for:

- Shloime
- Two people who work the counter daily
- One person who uses the app occasionally (covers a shift, does the books)
- One person who has **never** seen it — a relative, a friend. This one is worth
  more than it sounds: everybody else has learnt their way around the rough
  edges and can no longer see them.

Run them **one at a time**, on the **counter tablet**, not on a laptop. The whole
quality programme has been aimed at that device; testing on a desktop tests a
machine nobody serves customers on.

## How to run it — the four rules

1. **They do the task. You do not.** Hands off, and no pointing at the screen.
2. **Say nothing while they work**, however hard that is. Silence is the data.
   If they ask "is this right?", answer "what would you do if I weren't here?"
3. **Ask them to think out loud.** "Tell me what you're looking for" at the
   start of each task, once, and then leave them to it.
4. **You are testing the app, not the person.** Say so before you start, and
   mean it — if somebody struggles, that is a finding, not a failure. Write it
   down without comment.

Before you begin, say this, roughly:

> I want to see whether this app is any good, and the only way to find out is to
> watch somebody use it. Nothing here is a test of you. If you get stuck, that
> is the most useful thing that can happen — it means we found something to fix.
> Please say what you're thinking as you go.

## What to write down

For each task: **finished it? / gave up? / did it the long way round?**, how long
it took, and every place they hesitated or went the wrong way. The hesitations
are worth more than the times.

---

## The task script

Five tasks, in this order, matching the five flows the app is actually for. Read
each one out as written — a task read differently is a different task.

> **1.** A customer is standing in front of you. They want to hire a travel
> phone for two weeks, starting today. Their name is *[pick a real customer]*.
> Set it up and take a £50 deposit.

> **2.** *[Pick a rental that is out.]* This customer has just brought their
> phone back. Take it back in and tell me what they owe.

> **3.** *[Pick a customer with a balance.]* This customer wants to pay £20 off
> what they owe, in cash. Do that, and then show me their balance.

> **4.** Somebody wants a phone charger and a pair of earphones. Ring it
> through the till and take the money in cash.

> **5.** *[Pick a customer.]* They want a flight to Tel Aviv on *[a date about
> six weeks out]*, £310, and they'll pay later. Get it into the system.

After each task, before moving on, ask the **Single Ease Question**:

> **Overall, how difficult or easy was that task?**
> 1 = very difficult … 7 = very easy

Take the first number they say. Do not discuss it, do not let them revise it,
and do not react to it. Then go straight to the next task.

---

## After all five tasks: the System Usability Scale

Ten statements, each answered 1 (strongly disagree) to 5 (strongly agree). Hand
them the list and let them fill it in themselves — this one is not read aloud,
because reading it aloud invites them to be polite.

Wherever it says "the system", say "this app".

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

*(Brooke, J. (1996) "SUS: A quick and dirty usability scale". Free to use with
acknowledgement. The odd-numbered statements are positive and the even-numbered
ones negative on purpose — it stops people ticking straight down one column.)*

### Scoring SUS

Per person:

- **Odd items (1, 3, 5, 7, 9):** score = their answer **− 1**
- **Even items (2, 4, 6, 8, 10):** score = **5 −** their answer
- Add the ten results (0–40), **multiply by 2.5** → 0–100.

Then average across the five people.

**Read it against this, not as a percentage** — 68 is the published average, so
a score of 68 is *ordinary*, not a D grade:

| SUS | What it means |
|---|---|
| 85+ | Excellent. Top ~10% of systems. |
| 80.3+ | The "A" boundary; people recommend it unprompted. |
| 68 | Average. Half of all systems score below this. |
| 51 | Poor — expect complaints and workarounds. |

**The target for this app is 90+**, which is a demanding bar and the right one:
this is not software people chose, it is software they have to use all day.

### Scoring SEQ

Average the five task scores per person, then across people. **5.5 is roughly
average** for a task in published data; anything below **5** on a single task is
a flag, and the task itself is the finding — go and watch that one again.

---

## Visual aesthetics — VisAWI-S

Eight statements, 1 (strongly disagree) to 7 (strongly agree). Two for each of
the four things that drive whether a screen *feels* right: **simplicity**,
**diversity**, **colourfulness**, and **craftsmanship**.

Wording adapted for a British reader and for an app rather than a website. If a
score that can be compared against published benchmarks is wanted, use the
original items from Moshagen & Thielsch (2013), *"Facets of visual aesthetics"* —
these are close in construct but are not the published wording.

1. The layout is pleasingly varied.
2. Everything goes together on this screen.
3. The layout is easy to take in at a glance.
4. The colours work well together.
5. The screen is laid out with care.
6. The design looks professional.
7. The colour scheme is appealing.
8. There is nothing on screen that does not need to be there.

**Scoring:** straight average of the eight, 1–7. **Above 5 is good**; below 4.5
on any single item, ask what they were looking at when they answered.

---

## What to do with the answers

Three numbers and a page of notes. In order of how much they are worth:

1. **The notes.** Every hesitation, every wrong turn, every "where is…". This is
   the finding list. Anything two people did is worth fixing this week.
2. **SEQ per task.** Tells you *which* of the five flows is the problem.
3. **SUS.** One number for the whole app, useful mainly for comparing against
   itself later. Run it again after changes and the direction tells you whether
   the changes helped.

Write the numbers, the date and the participant count into this file when you
have them, so the next run has something to be compared against.

---

## A note on what was asked for

The brief named **CSIS**, which does not correspond to a standard instrument;
the nearest are the **CSUQ** (Computer System Usability Questionnaire, Lewis
1995) and the **CSI** (Creativity Support Index, which measures something else
entirely). SUS plus SEQ plus VisAWI-S covers the same ground as CSUQ in a third
of the time — CSUQ is nineteen items and asks four people to sit through the
same afternoon twice. If a CSUQ score is specifically wanted, say so and it can
be added; it is not worth the extra twenty minutes per person otherwise.

## And a warning about the scores

Five people is enough to find most of the *problems* and not enough to make the
*numbers* precise. A SUS mean from five participants carries a margin of roughly
±12 points. Treat 90 from five people as "this is very likely good" rather than
as a measurement, and never report it to anybody as a bare figure without the
participant count beside it.
