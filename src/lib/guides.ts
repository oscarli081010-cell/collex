// Text wrapped in *asterisks* shows in the accent italic, for the words a reader should not miss.
// The guides: short, practical pages for chairs, delegates and organisers. Each is plain data (a heading and paragraphs
// or steps per section), so the pages that show them stay one template. The two procedure guides describe the rules
// as Collex runs them; a conference's own handbook always wins where it differs, and each guide says so.

export type GuideSection = { id: string; title: string; text?: string[]; steps?: string[] };
export type Guide = { slug: string; title: string; accent: string; lead: string; for: "Chairs" | "Delegates" | "Organisers"; minutes: number; sections: GuideSection[] };

export const GUIDES: Guide[] = [
  {
    slug: "chairing-with-chambers", title: "Chair a committee on", accent: "Collex", for: "Chairs", minutes: 6,
    lead: "From opening the committee to the final vote, on one laptop and a projector.",
    sections: [
      { id: "before", title: "Before the session", steps: [
        "Log in, open Committees and choose Start a Committee. Pick the procedure your conference uses: Evatt, Trinity Grammar MUN, Standard, or Custom.",
        "Type the committee’s name and its topic or resolution, set the speaking time, and add the member states. Paste a list, or add a whole group such as the Security Council in one go.",
        "Leave “Delegates join on their own devices” *off* for a device-free conference. Turn it on only if delegates will have phones or laptops in the room.",
        "Press Open Display and drag that tab to the projector. It follows the console by itself.",
      ] },
      { id: "share", title: "Share it with your co-chair", text: [
        "Every committee you start is saved to your Collex account, so nothing is lost if a laptop dies. In the Share tab, give your co-chair the join code, or add them by the email on their Collex account, and both of you can run the console at once from your own laptops.",
      ] },
      { id: "running", title: "Running debate", steps: [
        "Take the roll call: Absent, Present, or Present & Voting. A state that is *Present & Voting cannot abstain* on the resolution.",
        "*The big button always does the next thing.* The space bar starts and pauses the timer, and N calls the next speaker.",
        "Add states to the speakers’ list as they raise their placards. Use the arrows to reorder it.",
        "Take votes by placard with the counters, or switch a vote to By Roll Call to record each state’s answer in the minutes.",
        "Made a mistake? *The back arrow undoes* your last few actions, including a vote recorded too soon.",
      ] },
      { id: "marks", title: "Marks", text: [
        "Analytics counts every speech, point and amendment for you. In Scores, mark each state *out of 10* for speaking, diplomacy, knowledge and procedure, and keep a private note. Only the chairs on the committee see the marks.",
        "Link the committee to its conference in the Share tab and the secretariat can follow it live from their Manage page.",
      ] },
      { id: "devices", title: "If delegates have devices", text: [
        "Turn on Delegates’ Devices in the Share tab and put the delegates’ code on the display. Each delegate picks their state, then can ask for the floor, raise a point, propose a motion, hand in or sign an amendment, vote, and pass notes.",
        "*Nothing a delegate sends changes the committee by itself.* Each request waits in your inbox at the top of the Manage tab until you accept or dismiss it, so your ruling stays final. Chairs can read every note.",
      ] },
    ],
  },
  {
    slug: "evatt-procedure", title: "Evatt procedure,", accent: "step by step", for: "Chairs", minutes: 5,
    lead: "The Security Council format used by UN Youth Australia’s Evatt competition, as Collex runs it.",
    sections: [
      { id: "note", title: "First, a caution", text: ["This is how Collex steps through an Evatt round. Your competition’s own rules and *the President’s ruling come first* wherever they differ."] },
      { id: "opening", title: "Opening", steps: [
        "The President welcomes the council and takes the roll call.",
        "The President names the Proposer and the Seconder of the resolution, and an Opposer if a state wishes to oppose.",
        "The Proposer, then the Seconder, then the Opposer each speak. After a speech the President asks how the speaker yields: to Points of Information (a short question, then a short reply, one at a time) or to the chair.",
        "The negotiation chamber and note-passing *open as the Seconder starts to speak*.",
      ] },
      { id: "debate", title: "Debate", steps: [
        "The council moves into a caucus, where states negotiate and write amendments.",
        "Amendments are handed to the President with their signatories and taken one at a time.",
        "For each amendment: it is read, the council votes on whether to debate it, the state that moved it speaks, then speakers alternate For and Against, and the council votes on adopting it.",
        "A vote on an amendment passes with more For than Against. The President may overrule.",
      ] },
      { id: "closing", title: "Closing and the vote", steps: [
        "When debate is closed, the Proposer, Seconder and Opposer may each give a closing speech. There are no Points of Information in the closing.",
        "The council votes on the resolution by roll call: For, Against or Abstain. A state that answered Present & Voting *must vote For or Against*.",
        "On Collex the resolution is approved with the votes of *three-fifths of all member states*. An abstention counts for neither side, but the number needed stays the same.",
      ] },
    ],
  },
  {
    slug: "trinity-procedure", title: "Trinity Grammar MUN", accent: "procedure", for: "Chairs", minutes: 5,
    lead: "Opening statements, a seen and an unseen resolution, motions and amendments, as Collex runs them.",
    sections: [
      { id: "note", title: "First, a caution", text: ["This follows the rules Collex was built to for Trinity Grammar MUN. *The conference’s handbook for the year comes first* wherever it differs."] },
      { id: "opening", title: "Opening", steps: [
        "Roll call, then opening statements: every state present speaks in alphabetical order, up to 90 seconds each.",
        "The committee has two resolutions: one seen in advance, one unseen. The chair introduces one at a time.",
        "When a resolution is introduced, its proposer and co-sponsor are named and the chair asks for an opposer. Each of the three speaks.",
      ] },
      { id: "debate", title: "Debate and motions", steps: [
        "States join the speakers’ list for the resolution and speak For or Against.",
        "Any state may raise a motion: a moderated caucus (a topic, a total time and a time per speaker), an unmoderated caucus, an extension (at most twice, and no longer than the caucus was), closing a moderated caucus, or closing debate.",
        "The chair puts motions in order and each is voted on by placard.",
        "An amendment needs a proposer and a seconder, and gathers as many signatories as it can. A clause that has already been amended needs full consensus to be amended again. An amendment’s debate runs like a moderated caucus: ten minutes in all, a minute each.",
        "A right of reply is 20 seconds. The chair can also log points of order, personal privilege, procedural inquiry and clarification.",
      ] },
      { id: "closing", title: "Closing and the vote", steps: [
        "After debate closes there is one final unmoderated caucus, then closing speeches: the opposer first, then the co-sponsor, then the proposer.",
        "The vote is by roll call. A resolution passes with *more For than Against*; abstentions count for neither.",
        "The committee then returns to choose its next resolution.",
      ] },
    ],
  },
  {
    slug: "your-first-conference", title: "Your first", accent: "MUN conference", for: "Delegates", minutes: 5,
    lead: "What actually happens on the day, and how to be ready for it.",
    sections: [
      { id: "what", title: "What you are doing", text: [
        "*You represent a country, not yourself.* Your job is to argue for what that country would want, find others who want something similar, and get a resolution passed that your country can live with.",
        "Nobody expects a first-timer to dominate. Chairs notice delegates who speak up early, stay in character, and help others get their ideas into the resolution.",
      ] },
      { id: "before", title: "The week before", steps: [
        "Read the background guide for your committee twice. It is on the conference’s Collex page once the organisers release it.",
        "Find out three things about your country: who its allies are, what it has said about this topic, and what it will never agree to.",
        "Write a 60-second opening speech: who you are, the one thing your country cares most about, and one thing you want the committee to do.",
        "Check the dress code and the start time on the conference’s page. Follow the conference on Collex to be emailed before each deadline.",
      ] },
      { id: "day", title: "On the day", steps: [
        "At roll call, answer “Present” or “Present and Voting”. Present and Voting means *you give up the right to abstain*.",
        "Put your placard up for the speakers’ list early. The first few speeches are the easiest to give, because nobody has said your points yet.",
        "In unmoderated caucus, walk to the delegates who agreed with you and start writing clauses together. *This is where most of the real work happens.*",
        "If you disagree with a clause, write an amendment and find signatories for it rather than only speaking against it.",
        "Vote the way your country would, even when you personally disagree.",
      ] },
      { id: "words", title: "Words you will hear", text: [
        "Point of Information: a short question to the speaker. Point of Order: you think a rule was broken. Motion: a request to the chair to do something, such as a caucus. Moderated caucus: short speeches on one narrow topic. Unmoderated caucus: everyone gets up and negotiates. Sponsor: a state that wrote a resolution. Signatory: a state that wants it debated.",
      ] },
    ],
  },
  {
    slug: "writing-a-resolution", title: "How to write a", accent: "resolution", for: "Delegates", minutes: 4,
    lead: "The format chairs expect, clause by clause.",
    sections: [
      { id: "shape", title: "The shape", text: [
        "*A resolution is one long sentence.* It opens with the committee’s name, then gives its reasons in preambulatory clauses, then says what should be done in operative clauses.",
      ] },
      { id: "pre", title: "Preambulatory clauses", text: [
        "These say why the committee is acting: past resolutions, facts, and concerns. Each starts with a phrase in italics, such as Noting, Recalling, Deeply concerned by, Recognising or Reaffirming, and ends with a comma.",
      ] },
      { id: "op", title: "Operative clauses", text: [
        "These are the actions, and they are what the committee argues about. Each is numbered, starts with an underlined verb such as Calls upon, Urges, Requests, Encourages or Decides, and ends with a semicolon. The last one ends with a full stop.",
        "*Make each clause do one thing*, and say who does it, what they do and how it is paid for or checked. Sub-clauses, lettered (a), (b), (c), carry the detail.",
      ] },
      { id: "tips", title: "What makes one pass", steps: [
        "*Get signatories early.* A draft with many signatures is debated first and looks like the room’s work rather than yours.",
        "Borrow the other bloc’s best clause. It costs you little and wins their votes.",
        "Avoid anything your own country would never sign. Chairs notice when a delegate breaks policy to win.",
        "Read it aloud once. If you run out of breath, split the clause.",
      ] },
    ],
  },
  {
    slug: "running-a-school-conference", title: "Run a school", accent: "MUN conference", for: "Organisers", minutes: 6,
    lead: "A checklist from the first approval to the closing ceremony.",
    sections: [
      { id: "early", title: "Three to six months out", steps: [
        "Get approval from your school’s executive, with a date, a venue, a teacher in charge and a budget.",
        "*Check the date* against the Collex calendar so you don’t land on another conference’s weekend.",
        "Choose your procedure and your committees, and appoint a secretariat: at least a Secretary-General, someone for delegates, someone for chairs and someone for logistics.",
        "List the conference on Collex. A listing can go up with only a date and a host; add the rest as you decide it.",
      ] },
      { id: "middle", title: "One to three months out", steps: [
        "Open chair applications first, then delegate registration. Turn on registrations or applications on Collex, or link your own form.",
        "Post the roles you need help with, such as press, photography and tech, so they appear on the Open Roles page.",
        "Write the background guides and upload them to the listing. Everyone following the conference is emailed when they appear.",
        "Add your key dates. Followers are reminded three days and one day before each.",
      ] },
      { id: "late", title: "The last month", steps: [
        "Accept delegates and allocate committees and countries from the Manage page, then email everyone their allocation in one go.",
        "*Send one email with everything for the day:* arrival time, room, dress and what to bring.",
        "Have each chair set up their committee under Committees and link it to the conference, so you can follow every room from the Manage page.",
        "Print placards and a paper copy of every country list, *in case the projector fails*.",
      ] },
      { id: "day", title: "On the day and after", steps: [
        "Keep the Manage page open on one laptop: it shows *what every committee is doing* right now.",
        "Thank your chairs and staff by name at the closing ceremony.",
        "Within a week, write down what you would change. Next year’s secretariat will need it.",
      ] },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
