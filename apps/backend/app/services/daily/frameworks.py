"""The framework library — what a day's practice snippet actually teaches.

This replaces the original content taxonomy (`opening_hook`, `structure`,
`general_tip`, ...). Those categories described a *subject*, which is why the
content they produced read as filler: "here is a tip about structure" teaches
nothing, because there is nothing in the category itself to apply.

A named framework does. Each entry below carries its exact step order, the
situations it actually fits, and a worked example in the same 2-3 sentence
body + one-line tip shape the app ships. The worked example is the important
part: it is injected into the generation prompt as a single few-shot, because
showing the model one correct application calibrates it far better than any
amount of describing what "apply the framework" means.

Deliberately a seed set, not a fixed list — see `framework_for` in
tasks/daily_tasks.py for what adding one does to the rotation.
"""

from dataclasses import dataclass

from app.utils.enums.daily_enums import SituationTag


@dataclass(frozen=True)
class Framework:
    id: str
    #: Full descriptive name, used in the generation prompt where the model
    #: benefits from seeing the steps spelled out in the title.
    name: str
    #: Compact label for UI — a widget badge is ~20 characters wide, and
    #: "PREP — Point, Reason, Example, Point" is not that. Sent to the client as
    #: `frameworkLabel`.
    short_name: str
    #: Step order, applied exactly and in this order. The generation prompt
    #: reproduces this list verbatim as a hard rule.
    steps: tuple[str, ...]
    #: One short gloss per step, positionally aligned with `steps`. A step name
    #: alone ("Point", "Agitate") says what to call the beat, not what to do in
    #: it; these are what make the explainer teachable. Kept separate from
    #: `steps` so the generation prompt still sends the bare step order.
    step_hints: tuple[str, ...]
    #: Lucide glyph for the explainer's header tile.
    icon: str
    #: Situations this framework genuinely fits. The rotation picks the day's
    #: situation from here, never from the full enum — PREP belongs in a Q&A,
    #: not in a product demo.
    best_for: tuple[SituationTag, ...]
    #: One line explaining what the framework is for, shown behind the info
    #: button on the practice intro. Written for someone who has never heard of
    #: it — the step list alone tells you the shape, not when to reach for it.
    description: str
    #: A correct application, used as the prompt's few-shot.
    example_body: str
    example_tip: str


S = SituationTag

FRAMEWORKS: tuple[Framework, ...] = (
    Framework(
        id="PREP",
        icon="layers",
        step_hints=(
            "State your answer clearly.",
            "Explain why it holds.",
            "Give one real example.",
            "End on the takeaway.",
        ),
        description=(
            "Answer first, then justify it. The fastest way to sound decisive when someone puts you on the spot."
        ),
        short_name="PREP",
        name="PREP — Point, Reason, Example, Point",
        steps=("Point", "Reason", "Example", "Point"),
        best_for=(S.INTERVIEW, S.BUSINESS, S.CONFERENCE),
        example_body=(
            "I think our team should ship the smaller feature first. Why? Because it gets "
            "real user feedback in front of the bigger redesign, so we're not guessing for "
            "three more weeks. Case in point — that's exactly what saved us on the last release."
        ),
        example_tip=(
            "State your answer before your reasoning — PREP fails if you reason your way "
            "toward the point instead of leading with it."
        ),
    ),
    Framework(
        id="STAR",
        icon="star",
        step_hints=(
            "Set the scene in a line.",
            "Say what you were asked to do.",
            "Spend most of your time here.",
            "Close on the measurable change.",
        ),
        description=(
            "Turn a past experience into evidence: what the situation was, what you did, and what changed because of it."
        ),
        short_name="STAR",
        name="STAR — Situation, Task, Action, Result",
        steps=("Situation", "Task", "Action", "Result"),
        best_for=(S.INTERVIEW, S.BUSINESS),
        example_body=(
            "Our onboarding flow had a 40% drop-off point I was asked to fix. I redesigned "
            "the first three screens around a single call-to-action instead of five competing "
            "ones. Drop-off fell to 22% within two weeks."
        ),
        example_tip=(
            "Spend 70% of your airtime on Action — Situation and Task are just enough context "
            "to make Action make sense."
        ),
    ),
    Framework(
        id="WHAT_SO_WHAT_NOW_WHAT",
        icon="trending-up",
        step_hints=(
            "State the fact plainly.",
            "Say why it matters to them.",
            "Name the next concrete move.",
        ),
        description=(
            "Report a fact, say why it matters, then say what happens next. Stops updates being just information."
        ),
        short_name="So What / Now What",
        name="What → So What → Now What",
        steps=("What", "So What", "Now What"),
        best_for=(S.BUSINESS, S.TECHNICAL_EXPLANATION, S.CONFERENCE),
        example_body=(
            "Our API latency doubled last week. That matters because it's the layer every "
            "other team's feature depends on. So the plan is: roll back the last deploy today, "
            "and pair on a proper fix by Thursday."
        ),
        example_tip=(
            "Never skip \"So What\" — a fact without stakes doesn't move anyone to act."
        ),
    ),
    Framework(
        id="SCQA",
        icon="help-circle",
        step_hints=(
            "Where things stand today.",
            "What broke or changed.",
            "The question that raises.",
            "Your answer to it.",
        ),
        description=(
            "Build tension before you resolve it, so the audience wants the answer before you give it."
        ),
        short_name="SCQA",
        name="SCQA — Situation, Complication, Question, Answer",
        steps=("Situation", "Complication", "Question", "Answer"),
        best_for=(S.BUSINESS, S.TECHNICAL_EXPLANATION, S.ACADEMIC),
        example_body=(
            "Our club runs five events a semester. But turnout has dropped every semester for "
            "two years straight. So how do we get students back in the room? We switch from "
            "generic talks to hands-on, resume-ready workshops."
        ),
        example_tip=(
            "The Complication is the whole engine — if there's no real tension, there's no "
            "reason to keep listening."
        ),
    ),
    Framework(
        id="PAS",
        icon="alert-circle",
        step_hints=(
            "Name the problem.",
            "Make its cost concrete.",
            "Offer the fix.",
        ),
        description=(
            "Name a problem, make its cost concrete, then offer the fix. The classic persuasive shape."
        ),
        short_name="PAS",
        name="PAS — Problem, Agitate, Solution",
        steps=("Problem", "Agitate", "Solution"),
        best_for=(S.SALES, S.PRODUCT_DEMO, S.BUSINESS),
        example_body=(
            "Manually tracking expenses across three apps means you lose receipts and miss "
            "deductions every single month. Multiply that by a year and it's real money walking "
            "out the door. That's exactly why we built one dashboard that pulls all three in "
            "automatically."
        ),
        example_tip=(
            "Agitate with a concrete cost (time, money, embarrassment) — vague agitation "
            "(\"it's frustrating\") doesn't land."
        ),
    ),
    Framework(
        id="FOUR_PS",
        icon="shield-check",
        step_hints=(
            "Name the problem.",
            "Show what it costs.",
            "Prove you can fix it.",
            "Promise the outcome.",
        ),
        description=(
            "Earn credibility before you ask. Proof lands before the promise, so the ask sounds grounded."
        ),
        short_name="4Ps",
        name="4Ps — Problem, Pain, Proof, Promise",
        steps=("Problem", "Pain", "Proof", "Promise"),
        best_for=(S.SALES, S.BUSINESS),
        example_body=(
            "Most freelancers undercharge because they don't know their real hourly cost. That "
            "mistake compounds — a year of underpricing can mean tens of thousands left on the "
            "table. Our calculator has already helped 2,000 freelancers fix their rates, and "
            "here's what it'll do for you: know your number in under five minutes."
        ),
        example_tip=(
            "Proof comes before Promise — credibility has to land before the ask does."
        ),
    ),
    Framework(
        id="AIDA",
        icon="megaphone",
        step_hints=(
            "Open with a surprise.",
            "Hold it with a reason.",
            "Make them want it.",
            "Ask for the step.",
        ),
        description=(
            "Open with a hook, hold attention, create want, then ask. Built for the first thirty seconds."
        ),
        short_name="AIDA",
        name="AIDA — Attention, Interest, Desire, Action",
        steps=("Attention", "Interest", "Desire", "Action"),
        best_for=(S.PRODUCT_DEMO, S.SALES, S.CONFERENCE),
        example_body=(
            "What if your slowest process took ten seconds instead of ten minutes? The "
            "bottleneck isn't your team — it's the five manual handoffs between tools. Picture "
            "your Monday without a single one of them, starting today: try it free for two weeks."
        ),
        example_tip=(
            "Attention has to be a genuine surprise or question — a bland fact doesn't earn "
            "the next sentence."
        ),
    ),
    Framework(
        id="GOLDEN_CIRCLE",
        icon="target",
        step_hints=(
            "Lead with the belief.",
            "How you act on it.",
            "Only now, what it is.",
        ),
        description=(
            "Lead with belief, not features. Why you do it, how you do it, and only then what it is."
        ),
        short_name="Golden Circle",
        name="Golden Circle — Why, How, What",
        steps=("Why", "How", "What"),
        best_for=(S.LEADERSHIP_TALK, S.CONFERENCE, S.SOCIAL),
        example_body=(
            "We believe every student deserves a mentor, not just a manual. So we pair every "
            "new member with someone two years ahead of them, one-on-one, every single week. "
            "That's what our peer-mentorship program actually is."
        ),
        example_tip=(
            "Say Why first and What last — reversing the order turns a mission into a feature list."
        ),
    ),
    Framework(
        id="MONROE",
        icon="flag",
        step_hints=(
            "Grab them.",
            "Show the gap.",
            "Present the fix.",
            "Paint life after.",
            "Ask for the act.",
        ),
        description=(
            "The full persuasive arc, ending on a picture of life after people act — not just the ask."
        ),
        short_name="Monroe's Sequence",
        name="Monroe's Motivated Sequence",
        steps=("Attention", "Need", "Satisfaction", "Visualization", "Action"),
        best_for=(S.CONFERENCE, S.LEADERSHIP_TALK, S.SALES),
        example_body=(
            "Three students in this room will drop out this year over a laptop they can't "
            "afford. Our fund exists to close exactly that gap. Picture this time next year: "
            "not one of them has to choose between rent and their degree — and it starts with "
            "₹500 from you tonight."
        ),
        example_tip=(
            "Visualization is the step people skip — paint the after, don't just ask for the action."
        ),
    ),
    Framework(
        id="ABT",
        icon="git-branch",
        step_hints=(
            "Set up the normal.",
            "Introduce the turn.",
            "Land the consequence.",
        ),
        description=(
            "Compress any story to one breath: this, but that, therefore this. If you can't, you don't understand it yet."
        ),
        short_name="ABT",
        name="ABT — And, But, Therefore",
        steps=("And", "But", "Therefore"),
        best_for=(S.BUSINESS, S.TECHNICAL_EXPLANATION, S.NETWORKING),
        example_body=(
            "We built the app for college students, and early signups were strong. But retention "
            "after week two was under 10%. Therefore we rebuilt onboarding around a single first "
            "win instead of a five-step tutorial."
        ),
        example_tip=(
            "If you can't compress your update into one \"and / but / therefore\" sentence, you "
            "don't understand it well enough yet."
        ),
    ),
    Framework(
        id="PIXAR_PITCH",
        icon="clapperboard",
        step_hints=(
            "The world before.",
            "The routine problem.",
            "The turning point.",
            "What it unlocked.",
            "Where it landed.",
        ),
        description=(
            "Tell it as a story with a turning point, so a product or project has a before and an after."
        ),
        short_name="Story Spine",
        name="Pixar Pitch / Story Spine",
        steps=("Once upon a time", "Every day", "Until one day", "Because of that", "Until finally"),
        best_for=(S.PRODUCT_DEMO, S.SOCIAL, S.CONFERENCE),
        example_body=(
            "Once upon a time, mascot animation meant hand-tweaking every frame. Every day, "
            "creators gave up halfway through because it took too long. Until one day we built "
            "Blooby — controls for limbs and curves instead of frames — and because of that, a "
            "ten-minute animation now takes ten seconds."
        ),
        example_tip=(
            "Keep each beat to a clause, not a paragraph — the spine only works if it stays skeletal."
        ),
    ),
    Framework(
        id="BEFORE_AFTER_BRIDGE",
        icon="route",
        step_hints=(
            "The old, painful way.",
            "The vivid new state.",
            "What got you across.",
        ),
        description=(
            "Show the old way, the new way, and the thing that got you across. Ideal for improvements."
        ),
        short_name="Before-After-Bridge",
        name="Before → After → Bridge",
        steps=("Before", "After", "Bridge"),
        best_for=(S.PRODUCT_DEMO, S.SOCIAL, S.SALES),
        example_body=(
            "Before, checking in on five different job applications meant five different tabs "
            "and a spreadsheet nobody updated. Now, one dashboard shows every status change the "
            "moment it happens. The bridge was simple: we just asked each site's API for what it "
            "already had."
        ),
        example_tip=(
            "Make \"After\" vivid and specific — a vague better state doesn't contrast against Before."
        ),
    ),
    Framework(
        id="CLAIM_EVIDENCE_MEANING",
        icon="check-check",
        step_hints=(
            "Make the claim.",
            "Back it with a number.",
            "Say why it matters.",
        ),
        description=(
            "Make a claim, back it with a number, then say what the number means. Never end on the stat."
        ),
        short_name="Claim-Evidence-Meaning",
        name="Claim → Evidence → Meaning",
        steps=("Claim", "Evidence", "Meaning"),
        best_for=(S.TECHNICAL_EXPLANATION, S.ACADEMIC, S.BUSINESS),
        example_body=(
            "Our new caching layer cut page load by 60%. We know because the P95 latency dropped "
            "from 800ms to 320ms in production monitoring. That means users on slow connections "
            "finally see content before they give up and leave."
        ),
        example_tip=(
            "Meaning is the step that turns a stat into a reason to care — never end on the "
            "number alone."
        ),
    ),
    Framework(
        id="RULE_OF_THREE",
        icon="list",
        step_hints=(
            "First bucket.",
            "Second bucket.",
            "Third bucket.",
        ),
        description=(
            "Group everything into three. More than three points and an audience remembers none of them."
        ),
        short_name="Rule of Three",
        name="Rule of Three",
        steps=("First", "Second", "Third"),
        best_for=(S.TEACHING, S.TECHNICAL_EXPLANATION, S.CONFERENCE),
        example_body=(
            "Our pipeline has three stages: clean the raw video, reconstruct the 3D geometry, "
            "then refine the final mesh. First, we strip out blurry or redundant frames. "
            "Second — and this is where most of the compute goes — we estimate camera pose and depth."
        ),
        example_tip=(
            "If you have seven points, you have zero points — group them into three buckets "
            "before you speak."
        ),
    ),
    Framework(
        id="CONTRAST",
        icon="shuffle",
        step_hints=(
            "The common assumption.",
            "Where it breaks down.",
            "What you do instead.",
        ),
        description=(
            "Set up what people assume, then break it. The strongest way to open and make a room lean in."
        ),
        short_name="Contrast",
        name="Contrast Framework",
        steps=("What most people think", "But the reality", "So what we do instead"),
        best_for=(S.CONFERENCE, S.SOCIAL, S.LEADERSHIP_TALK),
        example_body=(
            "Most resumes are written to list what you did. But nobody hiring cares what you did "
            "— they care what changed because you did it. So we flip every bullet point into a "
            "before/after instead of a task description."
        ),
        example_tip=(
            "The \"but\" is the whole opener — land it with a pause before you continue."
        ),
    ),
    Framework(
        id="TEACH_DEMONSTRATE_EXPLAIN",
        icon="presentation",
        step_hints=(
            "Name the idea.",
            "Show it working.",
            "Now explain the trick.",
        ),
        description=(
            "Show it working before you explain how it works. The explanation lands far better afterwards."
        ),
        short_name="Teach-Demo-Explain",
        name="Teach → Demonstrate → Explain",
        steps=("Teach", "Demonstrate", "Explain"),
        best_for=(S.PRODUCT_DEMO, S.TEACHING, S.TECHNICAL_EXPLANATION),
        example_body=(
            "Our system uses adaptive keyframing to skip redundant video frames. [Show the "
            "timeline graph] Notice how it keeps every frame where the scene actually changes, "
            "and drops the ones that look identical to the last one — that's the whole trick."
        ),
        example_tip=(
            "Never explain before you demonstrate — the explanation lands ten times better once "
            "they've already seen it."
        ),
    ),
    Framework(
        id="PYRAMID_PRINCIPLE",
        icon="triangle",
        step_hints=(
            "Lead with the decision.",
            "Give the reasons.",
            "Detail only if asked.",
        ),
        description=(
            "Conclusion first, then the reasons beneath it. What senior audiences expect and rarely get."
        ),
        short_name="Pyramid Principle",
        name="Pyramid Principle — conclusion first",
        steps=("Conclusion", "Supporting reasons", "Detail beneath each reason"),
        best_for=(S.BUSINESS, S.ACADEMIC, S.TECHNICAL_EXPLANATION),
        example_body=(
            "We chose the smaller vendor over the bigger one. Here's why: three-week onboarding "
            "versus their twelve, and a support team that answers in hours, not days. We did "
            "compare five vendors total before landing here."
        ),
        example_tip=(
            "State the decision in your very first sentence — if you're building up to it, you've "
            "lost a Pyramid-Principle audience already."
        ),
    ),
    Framework(
        id="FEYNMAN",
        icon="lightbulb",
        step_hints=(
            "Drop the jargon.",
            "Reach for the everyday.",
            "Cut any term they'd miss.",
        ),
        description=(
            "Explain it in words a smart twelve-year-old would follow. If you need jargon, you don't have it yet."
        ),
        short_name="Feynman",
        name="Feynman Technique",
        steps=(
            "Say it in plain words",
            "Use an everyday analogy",
            "Strip every term a non-expert wouldn't know",
        ),
        best_for=(S.TECHNICAL_EXPLANATION, S.TEACHING, S.ACADEMIC),
        example_body=(
            "A neural network is just a machine that adjusts a few million dials until its "
            "guesses stop being wrong. Every time it's wrong, it nudges the dials a tiny bit in "
            "the direction that would've made it more right. Do that billions of times and the "
            "dials settle into something that works."
        ),
        example_tip=(
            "If you used a term a smart twelve-year-old wouldn't know, go back and replace it — "
            "that's the whole test."
        ),
    ),
    Framework(
        id="ELEVATOR_PITCH",
        icon="rocket",
        step_hints=(
            "Name the audience.",
            "Name the category.",
            "Name the benefit.",
            "Name the alternative.",
        ),
        description=(
            "Who it's for, what it is, why it's better — in one sentence you can say without thinking."
        ),
        short_name="Elevator Pitch",
        name="Elevator Pitch / Positioning Statement",
        steps=("For [who]", "[product] is a [category]", "that [benefit]", "unlike [alternative]"),
        best_for=(S.NETWORKING, S.SALES, S.INTERVIEW),
        example_body=(
            "For students who freeze up before presentations, Sailors is a practice app that "
            "gives you real-time feedback on your delivery. Unlike recording yourself and "
            "rewatching, it tells you what to fix while you're still speaking."
        ),
        example_tip=(
            "Fill in the blanks out loud — \"For [who], [product] is a [category] that [benefit], "
            "unlike [alternative]\" — before you write the polished version."
        ),
    ),
    Framework(
        id="HOOK_STORY_OFFER",
        icon="anchor",
        step_hints=(
            "Open a loop.",
            "Earn it with a story.",
            "Close with the ask.",
        ),
        description=(
            "Open a loop, tell the story that earns it, then make the ask. Informal and conversational."
        ),
        short_name="Hook-Story-Offer",
        name="Hook-Story-Offer",
        steps=("Hook", "Story", "Offer"),
        best_for=(S.SOCIAL, S.SALES, S.NETWORKING),
        example_body=(
            "I used to bomb every single client call I had. Then I started opening every call "
            "with the client's own numbers instead of my slides, and close rates tripled. If you "
            "want the exact three questions I ask first, stick around to the end."
        ),
        example_tip=(
            "The Offer only works if the Hook created a real open loop — don't tease something "
            "you don't deliver on."
        ),
    ),
    Framework(
        id="SEVEN_PS",
        icon="clipboard-list",
        step_hints=(
            "What should change?",
            "Do the groundwork.",
            "Shape the structure.",
            "Rehearse it aloud.",
            "Deliver it.",
            "Invite the room in.",
            "Read and adjust.",
        ),
        description=(
            "A preparation checklist, not a speech shape. Use it to pressure-test a talk before you give it."
        ),
        short_name="7 Ps",
        name="7 Ps of Public Speaking",
        steps=(
            "Purpose", "Preparation", "Plan", "Practice",
            "Presentation", "Participation", "Performance",
        ),
        best_for=(S.OTHER, S.TEACHING),
        example_body=(
            "Before you write a single line, get clear on your Purpose — what do you want the "
            "room to do differently after you speak? Everything else — your Plan, your Practice "
            "reps, even how you handle Participation — only works once that's nailed down."
        ),
        example_tip=(
            "Write your Purpose as one sentence and read it back before every rehearsal."
        ),
    ),
    Framework(
        id="DEPTH_SCALING",
        icon="maximize-2",
        step_hints=(
            "One sentence.",
            "Add why it's hard.",
            "Add how it works.",
        ),
        description=(
            "One idea at three lengths, so you can answer 'what do you do?' in ten seconds or two minutes."
        ),
        short_name="10 / 30 / 2-Minute",
        name="10 / 30 / 2-Minute Depth Scaling",
        steps=("The 10-second version", "The 30-second version", "The 2-minute version"),
        best_for=(S.NETWORKING, S.INTERVIEW, S.TECHNICAL_EXPLANATION),
        example_body=(
            "In ten seconds: \"I'm building a tool that turns drone footage into a 3D model in "
            "one pass.\" In thirty: add why that's hard — most tools need dozens of overlapping "
            "shots, ours needs one flyover. The two-minute version adds the architecture, the "
            "trade-offs, and what's next."
        ),
        example_tip=(
            "Practice the 10-second version last — it's the hardest to compress, not the easiest."
        ),
    ),
)

# Positional alignment is the whole contract between `steps` and `step_hints`:
# the explainer zips them, so a mismatched length silently drops or mislabels a
# step rather than failing anywhere visible.
for _f in FRAMEWORKS:
    assert len(_f.steps) == len(_f.step_hints), (
        f"{_f.id}: {len(_f.steps)} steps but {len(_f.step_hints)} hints"
    )

FRAMEWORKS_BY_ID: dict[str, Framework] = {f.id: f for f in FRAMEWORKS}

#: Human labels for the client, so the app doesn't ship a second copy of this
#: table that can drift. Sent inline on each unit as `frameworkLabel` rather
#: than through an endpoint of its own — the app only ever needs the label for
#: the framework it was just handed.
FRAMEWORK_LABELS: dict[str, str] = {f.id: f.short_name for f in FRAMEWORKS}

#: Sent with each unit for the info button on the practice screen.
FRAMEWORK_DESCRIPTIONS: dict[str, str] = {f.id: f.description for f in FRAMEWORKS}
