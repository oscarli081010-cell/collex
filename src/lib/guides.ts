// Text wrapped in *asterisks* shows in the accent italic, for the words a reader should not miss.
// The guides: short, practical pages for chairs, delegates and organisers. Each is plain data (a heading and paragraphs
// or steps per section), so the pages that show them stay one template. The two procedure guides describe the rules
// as Collex runs them; a conference's own handbook always wins where it differs, and each guide says so.

export type GuideSection = { id: string; title: string; text?: string[]; steps?: string[] };
/** `updated` is the day the guide was last checked (yyyy-mm-dd). Guides written before the field existed have none. */
export type Guide = { slug: string; title: string; accent: string; lead: string; for: "Chairs" | "Delegates" | "Organisers"; minutes: number; updated?: string; sections: GuideSection[] };

export const GUIDES: Guide[] = [
  {
    slug: "chairing-with-committees", title: "Chair a committee on", accent: "Collex", for: "Chairs", minutes: 8, updated: "2026-11-22",
    lead: "From opening the committee to the final vote, on one laptop and a projector.",
    sections: [
      { id: "before", title: "Before the session", steps: [
        "Log in, open Committees and choose Start a Committee. Pick the procedure your conference uses: Evatt, Trinity Grammar MUN, Standard, or Custom. Custom runs like Standard, but you choose whether a resolution needs more For than Against or two-thirds of the votes cast. Read the matching guide first: Evatt procedure, Trinity Grammar MUN procedure or Standard procedure.",
        "Type the committee’s name and its topic (for Evatt, its resolution), set the speaking time, and add the member states. Paste a list, or use Add a Group to add a whole group such as the G20 in one go. Press Open Committee.",
        "Under Delegates Follow, leave *On the Display* chosen for a device-free conference. Choose On Their Own Devices only if delegates will have phones or laptops in the room.",
        "Press Open Display and drag that tab to the projector. It follows the console by itself.",
        "Want to practise first? On the Start a Committee tab, choose a procedure and press Try a Practice Committee. It opens a committee with a sample topic and 12 member states, and counts as one of your committees.",
      ] },
      { id: "share", title: "Share it with your co-chair", text: [
        "Every committee you start is saved to your Collex account, so nothing is lost if a laptop dies. In the Share tab, press Make a Join Code and give the code to your co-chair, or use Add by Email with the email on their Collex account. Your co-chair goes to Committees, chooses Join a Committee and types the code. Both of you can then run the console at once from your own laptops.",
      ] },
      { id: "running", title: "Running debate", steps: [
        "Press Start Roll Call, mark each state Absent, Present, or Present & Voting, then press Begin Debate. A state that is *Present & Voting cannot abstain* on the resolution. A Standard or Custom committee also shows how many states you need for a quorum.",
        "*The main button always does the next thing.* Keys work anywhere except while you are typing in a box: Space starts and pauses the timer, N calls the next speaker, E ends the speech, Y yields to the chair, and Ctrl or ⌘ with Z goes back one step. They are listed in Settings under Keyboard Shortcuts.",
        "N calls whoever is next: the next state on the speakers’ list, the proposer, seconder or opposer at their turn, or the proposer of the amendment in hand. It does nothing while someone is speaking, so a stray press can’t cut a speech short.",
        "Add states to the speakers’ list as they raise their placards. Use the arrows to reorder it.",
        "The timer keeps running past 0:00 and shows how far over the speaker is, such as +0:12. Use −15s, +15s and Reset to adjust it.",
        "Take votes by placard with the counters, or switch a vote to By Roll Call to record each state’s answer in the minutes. Press Record the Result. Overrule lets the chair set the result, and the minutes say so.",
        "In a Standard or Custom committee, the vote on a resolution lets each state answer For, Against, Abstain or Pass, and mark For or Against With Rights. See Standard procedure.",
        "In a Standard or Custom committee, a state can also move to divide the question. Press Divide the Question before anyone votes. See Standard procedure.",
        "To start a new session, press Retake the Roll: in a Trinity committee it is on the Choosing a Resolution screen, and in a Standard committee on the general speakers’ list. The earlier roll is kept.",
        "Made a mistake? *The back arrow undoes* your last step, and Ctrl or ⌘ with Z does the same. Press it again to go further back, up to the last 12 steps. With two chairs working, Back only undoes your own last step. If the last change was your co-chair’s, Collex says so and leaves it alone.",
      ] },
      { id: "display", title: "The display", text: [
        "The display shows the timer, speakers and results for the room. To put the delegates’ join code and a QR code on it, turn on Delegates’ Devices in the Share tab, then press Show Join Code. Hide Join Code takes it off.",
        "Display Sounds, in Settings, are off until you turn them on: a chime when a speech ends and again 10 seconds later, and a warning tone 10 seconds before the end. A browser needs one click on the display before it can play sound. The separate Device Sounds setting plays a chime on your own laptop.",
      ] },
      { id: "marks", title: "Marks", text: [
        "Analytics counts every speech, point and amendment for you. In Analytics, open Scores and press Mark on a state. Mark it *out of 10* for Speaking, Diplomacy, Knowledge and Procedure, and keep a private Chair’s Note. Only the chairs on the committee see the marks.",
        "If the committee is linked to its conference (in the Share tab), the secretariat can follow it live from their Manage page, and Scores shows Release Marks to Delegates. Each delegate then sees *only their own* mark and note, on their account page. Marks you change afterwards stay private until you press Release the Latest Marks, and Take Marks Back withdraws them.",
      ] },
      { id: "devices", title: "If delegates have devices", text: [
        "Turn On Delegates’ Devices in the Share tab. Press Show Join Code to put the delegates’ code and QR code on the display, or Copy Link to send it. Each delegate logs in, types the code and picks their state. Up to three people can sit as one state.",
        "*A delegate can’t change seat once seated.* To free a seat, press the X beside the delegate’s name on the Delegates’ Devices card (Take their seat away). If you would rather check each seat, open the Room tab and set Chairs Approve Seats to “A chair approves each seat first”. New seats then wait under Seat Requests at the top of the Manage tab until you press Approve or Decline.",
        "A seated delegate can ask for the floor, raise a point, propose a motion, hand in or sign an amendment, vote, and pass notes. *Nothing a delegate sends changes the committee by itself.* Each request waits in From Delegates’ Devices at the top of the Manage tab until you accept or dismiss it, so your ruling stays final. Chairs can read every note.",
      ] },
      { id: "offline", title: "Working without wifi", text: [
        "Open the console once with wifi first, on the laptop you will use. Then go to Settings: at the bottom it says *Ready to work without wifi on this laptop* when that laptop has kept everything it needs. If it says to open the page once with wifi, do that before the day.",
        "If the connection drops, that laptop keeps running the committee and says Offline. Your changes are saved on it and sent when it reconnects. The display, opened on the same laptop, keeps up with you.",
        "*Other devices don’t.* Every device syncs through Collex, so with no connection a second chair’s laptop and the delegates’ phones can’t see your changes until both ends are back online. Working without wifi is a backup for a dropped connection, not a way to run the room. If the school wifi is unreliable, run the main laptop from a phone hotspot.",
        "If two chairs change the committee while offline, both sets of changes are combined when they reconnect. The exception: a chair who reloads the page while offline loses their unsent changes if the other chair’s arrive first, and is told so.",
      ] },
      { id: "more", title: "Keep learning", text: [
        "For rulings, keeping time and marking on any procedure, read How to chair a committee. Unsure of a word? See the MUN glossary.",
      ] },
    ],
  },
  {
    slug: "evatt-procedure", title: "Evatt procedure,", accent: "step by step", for: "Chairs", minutes: 5, updated: "2026-11-22",
    lead: "The Security Council format used by UN Youth Australia’s Evatt competition, as Collex runs it.",
    sections: [
      { id: "note", title: "First, a caution", text: ["This is how Collex steps through an Evatt round. Your competition’s own rules and *the President’s ruling come first* wherever they differ. Unsure of a word? See the MUN glossary. For rulings and keeping time, read How to chair a committee."] },
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
        "On Collex the resolution is approved when the For votes reach *three-fifths of all the member states* on the committee’s list, rounded up, whether they are present or not. With 15 states that is 9 For votes, and with 13 it is 8. An abstention counts for neither side, and the number needed stays the same.",
      ] },
    ],
  },
  {
    slug: "trinity-procedure", title: "Trinity Grammar MUN", accent: "procedure", for: "Chairs", minutes: 5, updated: "2026-11-22",
    lead: "Opening statements, a seen and an unseen resolution, motions and amendments, as Collex runs them.",
    sections: [
      { id: "note", title: "First, a caution", text: ["This follows the rules Collex was built to for Trinity Grammar MUN. *The conference’s handbook for the year comes first* wherever it differs. Unsure of a word? See the MUN glossary. For rulings and keeping time, read How to chair a committee."] },
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
        "When delegates have devices, a point of order, personal privilege or procedural inquiry sent from a device is logged in the minutes once the chair accepts it.",
      ] },
      { id: "closing", title: "Closing and the vote", steps: [
        "After debate closes there is one final unmoderated caucus, then closing speeches: the opposer first, then the co-sponsor, then the proposer.",
        "The vote is by roll call. A resolution passes with *more For than Against*; abstentions count for neither.",
        "The committee then returns to choose its next resolution. For a new session, such as the next day, press Retake the Roll on the Choosing a Resolution screen and the earlier roll is kept.",
      ] },
    ],
  },
  {
    slug: "standard-procedure", title: "Standard procedure,", accent: "step by step", for: "Chairs", minutes: 7, updated: "2026-11-22",
    lead: "Roll call, caucuses, motions, amendments and a roll-call vote, in the THIMUN and Harvard style, as Collex runs it.",
    sections: [
      { id: "note", title: "First, a caution", text: [
        "School conferences vary, so *your conference’s handbook comes first* wherever it differs, and *the chair’s ruling is final*. This is how Collex steps through a Standard committee. A Custom committee runs the same way. Unsure of a word? See the MUN glossary. For rulings and keeping time, read How to chair a committee.",
      ] },
      { id: "roll", title: "Roll call and quorum", steps: [
        "Take the roll: mark each state Absent, Present, or Present & Voting. A state that is Present & Voting can’t abstain on a resolution.",
        "Quorum is the number of states that must be in the room. To open debate, a third of the member states, rounded up. To vote on a resolution, a majority of them: half plus one. Collex warns you when the room is short, but the chair can still carry on.",
      ] },
      { id: "opening", title: "The topic and the agenda", steps: [
        "The topic is set when the committee is made. Draft resolutions go into the Resolutions panel, with a title each, as the chairs receive them.",
        "After Begin Debate, each state that is present gives an opening statement, in alphabetical order, up to 90 seconds each. The chair presses Finish the Statements to move on.",
        "Debate then starts on the general speakers’ list. A state joins it with or without saying For or Against. Debate on a draft starts when the chair presses Introduce beside it.",
      ] },
      { id: "speaking", title: "Speakers, yields and points", steps: [
        "The chair calls the next state on the list. A speech is as long as the time per speaker the committee was given, which the chairs can change in Settings.",
        "After a speech the speaker yields. They can yield to Points of Information, to the chair, or to another country, which speaks next and gets the time left added to its own.",
        "A Point of Information is a short question. The chair picks the state, which has 30 seconds to ask. The speaker has 30 seconds to reply. Points are taken one at a time until the chair ends them. There are none in closing speeches.",
        "A point of order, personal privilege or inquiry is the chair’s to answer on the spot. When delegates have devices, one sent from a device is logged in the minutes once the chair accepts it.",
      ] },
      { id: "caucus", title: "Caucuses", steps: [
        "A moderated caucus has a topic, a total time of at most 20 minutes, and a time per speaker. Each speaker gets at least 5 seconds, and the speaker time must fit into the total evenly, such as 10 minutes at 1 minute. The chair calls speakers from the caucus’s own list. The general list waits, and comes back afterwards.",
        "An unmoderated caucus is 30 seconds to 20 minutes. Delegates move around and talk freely.",
        "A caucus can be extended twice at most. Each extension is no longer than the caucus first was, and it can only be moved once the caucus’s time has run out.",
        "A moderated caucus can be closed once its last three speakers have finished.",
      ] },
      { id: "motions", title: "Motions", steps: [
        "Any state can raise a motion. The chair adds it under Add a Motion. Collex lines up waiting motions in order of precedence, the most disruptive first. The chair can still move one by hand.",
        "The order is: unmoderated caucus, extend the caucus, moderated caucus, close the moderated caucus, close debate. When two are the same kind, the longer caucus goes first, then the one raised first.",
        "Each motion is put to a placard vote. Most need a *majority of the states present*, which is more than half. Close debate needs *two-thirds of the states present*. A state counts as present unless it is marked Absent. With 12 present, a majority is 7 and two-thirds is 8. Collex shows the number needed on each motion.",
        "Only For votes count towards the number needed, so an abstention doesn’t help a motion pass. Close debate can only be moved during the debate on a resolution. If a motion passes, Collex carries it out.",
      ] },
      { id: "resolutions", title: "Draft resolutions and amendments", steps: [
        "To introduce a draft, the chair picks a proposer and a co-sponsor, who must be different states, and an opposer if a state wishes to oppose. Each speaks: proposer, co-sponsor, then opposer, 90 seconds each unless the chairs change it. A 5-minute unmoderated caucus then opens the debate.",
        "The debate on the resolution runs from a speakers’ list with For and Against. Collex calls the other side after each speech where it can.",
        "An amendment is handed to the chair with a proposer, a seconder, the clause, whether it amends, strikes or adds, its wording, and as many co-sponsors as it can gather. A clause that has already been amended can only be amended again with full consensus, no votes against and no abstentions.",
        "The chair takes one amendment at a time, in the order they choose, and reads it out. The committee votes on whether to debate it. If not, it goes straight to the vote. The chair can also rule an amendment invalid.",
        "An amendment’s debate is a moderated caucus: ten minutes in all and a minute each, unless the chairs change it. The proposer speaks first.",
        "While an amendment is debated, one state can move an *amendment to the amendment*. Only one at a time, and none to that one. It has its own speakers’ list and is voted on first. If it passes, the amendment’s wording changes to the new wording. Then the debate on the amendment goes on and the amendment is voted on.",
        "An amendment passes with more For than Against, by placard or by roll call. Debate on the resolution then carries on.",
      ] },
      { id: "closing", title: "Closing debate and the vote", steps: [
        "Once debate is closed, the chair can hold a final unmoderated caucus of 4 minutes. Then come the closing speeches: opposer, co-sponsor, then proposer, 2 minutes each unless the chairs change it.",
        "Voting is by roll call. Each state present answers For, Against, Abstain or Pass. A state that is Present & Voting can’t abstain. Collex warns if fewer than half plus one of the states are present, but the chair can go on.",
        "A state that answers *Pass* is asked again once everyone else has answered, and then must vote For or Against. A state can pass only once.",
        "A state voting For or Against can mark it *With Rights*, which is Yes with Rights or No with Rights. Its vote counts as an ordinary For or Against. After the result, each state with rights may give an explanation of vote of up to 30 seconds, or the chair can skip it.",
        "Before anyone has voted, a state can move to *divide the question*. The chair presses Divide the Question and types each part on its own line, such as Operative Clause 3. Each part is voted on in turn, and a part that fails is struck. The rest is then voted on as a whole. Undo the Division works until the first part’s vote begins.",
        "The resolution passes with more For than Against, and abstentions count for neither. A Custom committee can instead need two-thirds of the votes cast. The chair presses Record the Result once every state has answered.",
        "Then Back to the Resolutions for the next draft, or End the Committee. Reopen the Vote fixes a result recorded too soon.",
        "A new session, such as after lunch or the next day, starts with Retake the Roll on the general speakers’ list. The new roll replaces the old, which is kept.",
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
        "Check what it costs and what to pack. The guide *What to wear, what to bring and what it costs* has a list, and a sheet for your parents is on each conference’s page.",
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
  {
    slug: "how-to-chair", title: "How to chair a", accent: "committee", for: "Chairs", minutes: 6, updated: "2026-11-22",
    lead: "Preparing, running debate fairly, ruling, keeping time and marking. For any procedure, on paper or on Collex.",
    sections: [
      { id: "note", title: "First, a caution", text: [
        "Every conference has its own rules for chairs. *The handbook and the secretariat come first* wherever they differ from this guide. To run the committee on a laptop, read Chair a committee on Collex as well.",
      ] },
      { id: "before", title: "Before the conference", steps: [
        "Read the background guide you or your co-chair wrote, then read it again as a delegate would. Note the three or four questions the committee has to answer.",
        "Learn the procedure well enough to run it without the handbook open: which motions exist, what order they go in, and what each vote needs to pass. Collex has a guide for each: Evatt procedure, Trinity Grammar MUN procedure and Standard procedure.",
        "Agree with your co-chair who calls speakers, who keeps time and who takes notes. Swap halfway through the day.",
        "Plan the day in blocks: roll call and opening speeches, debate, caucuses, voting. Know when lunch is and when the room must be empty.",
        "Print the country list and a few spare placards, *in case the projector fails*.",
      ] },
      { id: "fair", title: "Running debate fairly", steps: [
        "Explain the rules in two minutes at the start, and say that first-timers can ask you anything during a caucus.",
        "Keep a tally of who has spoken. When several placards go up, *choose the delegate who has spoken least*.",
        "Alternate speakers For and Against where the procedure allows, so one side does not fill the speakers’ list.",
        "Call delegates by their country’s name, never their own. It keeps the room formal and keeps you from favouring friends.",
        "Stay neutral. Your face and your tone should not show whether you agree with a speech.",
      ] },
      { id: "rulings", title: "Rulings", text: [
        "When a motion or point comes up, decide quickly and say why in one sentence: “That motion is out of order, because debate on this amendment is already closed.”",
        "*Be consistent.* If you allowed a motion from one delegate, allow the same motion from the next. If you are unsure, take a short pause, check the handbook with your co-chair, and rule. If a delegate still disagrees, the secretariat decides, not an argument on the floor.",
      ] },
      { id: "time", title: "Keeping time", steps: [
        "Tell the speaker their time before they start, and tap the gavel or desk once when ten seconds are left.",
        "When time is up, thank the speaker and move on. Letting one delegate run over is unfair to the next.",
        "Keep caucuses to the time voted for. Extend one only when a motion to extend passes.",
        "Leave at least twenty minutes for voting. A resolution that runs out of time is the most common way a committee ends badly.",
      ] },
      { id: "marks", title: "Marking", text: [
        "If your conference asks chairs to mark delegates, use its criteria and *take notes all day*, not only at the end. A line per speech is enough: country, what they said, and whether it moved the debate.",
        "Mark what delegates did, not how confident they looked. A quiet delegate who wrote the clause everyone voted for has done more than a loud one who repeated the background guide. Keep marks between the chairs.",
      ] },
      { id: "rooms", title: "A quiet room and a rowdy one", text: [
        "*A quiet room* needs smaller questions. Suggest a moderated caucus on one narrow point, such as who pays for a proposal, with short speaking times. In an unmoderated caucus, give the room a task: each bloc reports back with one clause in ten minutes.",
        "*A rowdy room* needs you to be calmer than it is. Wait for silence before you speak, use the gavel once rather than many times, and remind the room that notes and speeches go through the chair. Talk to a disruptive delegate quietly during a break, and bring in the secretariat if it continues.",
      ] },
    ],
  },
  {
    slug: "mun-glossary", title: "MUN", accent: "glossary", for: "Delegates", minutes: 6, updated: "2026-11-22",
    lead: "The words you will hear in committee, as Sydney school conferences use them.",
    sections: [
      { id: "note", title: "First, a caution", text: [
        "Conferences use these words in slightly different ways. *The conference’s handbook comes first* wherever it differs. Where UN Youth Australia’s Evatt competition uses its own word, it is noted at the end.",
      ] },
      { id: "room", title: "People and the room", text: [
        "*Chair*: the student who runs the committee, calls speakers and rules on motions. Most committees have two. Together they sit at the *dais*, the front table.",
        "*Secretariat*: the students who run the whole conference, led by the Secretary-General.",
        "*Delegate*: you. You speak for one country, called a *member state* or a *delegation*.",
        "*Placard*: the card with your country’s name. Raise it to speak, to vote and to be seen at roll call.",
        "*Background guide*: the document the chairs write about the topic. Read it first.",
        "*Bloc*: a group of countries that agree on a topic and work together, often by region.",
      ] },
      { id: "debate", title: "Debate", text: [
        "*Roll call*: the chair reads each country’s name. Answer “Present”, or “Present and Voting”, which means you cannot abstain on the final vote.",
        "*Speakers’ list*: the order in which countries give formal speeches.",
        "*Moderated caucus*: short speeches on one narrow question, called on by the chair.",
        "*Unmoderated caucus*: everyone leaves their seats to negotiate and write clauses.",
        "*Yield*: what you do with time left at the end of a speech. You can yield to points of information, to the chair (ending your turn), or, at some conferences, to another delegate.",
        "*Right of reply*: a short answer to a speech that insulted your country. The chair decides whether to grant it.",
      ] },
      { id: "points", title: "Points and motions", text: [
        "*Point of information*: a short question to the speaker about their speech, asked after it ends.",
        "*Point of order*: you think the chair or a delegate has broken the rules.",
        "*Point of personal privilege*: something stops you taking part, such as not being able to hear.",
        "*Point of parliamentary inquiry* (or procedural inquiry): a question to the chair about the rules.",
        "*Motion*: a request for the committee to do something, such as start a caucus or close debate. Most motions need a vote.",
      ] },
      { id: "writing", title: "Writing and voting", text: [
        "*Position paper*: a short paper setting out your country’s view before the conference. Not every conference asks for one.",
        "*Working paper*: early ideas written by a bloc, before they become a draft resolution.",
        "*Draft resolution*: the full document the committee debates and votes on.",
        "*Preambulatory clause*: a clause at the start of a resolution that gives a reason or a fact. It begins with a word like Recalling or Noting.",
        "*Operative clause*: a numbered clause that says what should be done. It begins with a verb like Urges or Calls upon.",
        "*Sponsor*: a country that wrote the resolution. *Signatory*: a country that wants it debated, without having to vote for it.",
        "*Amendment*: a change to a clause. Some conferences split amendments into friendly (all sponsors agree) and unfriendly (put to a vote).",
        "*Abstain*: vote neither For nor Against. Not allowed if you answered Present and Voting.",
      ] },
      { id: "evatt", title: "Where Evatt differs", text: [
        "In Evatt, the chair is the *President*. Each resolution has a *Proposer* and a *Seconder*, and a state may stand as the *Opposer*. Points of information are taken after a speech when the speaker yields to them. Evatt has its own rules for amendments and voting, set out in the Evatt procedure guide and the competition’s rules.",
      ] },
    ],
  },
  {
    slug: "position-paper", title: "Research your country and write a", accent: "position paper", for: "Delegates", minutes: 6, updated: "2026-11-22",
    lead: "Where to look, what to write down, and a simple shape for the paper.",
    sections: [
      { id: "start", title: "Start with the background guide", steps: [
        "Read your committee’s background guide once to understand the topic, then again with a pen. Mark every question it asks the committee.",
        "Write the topic as one line at the top of your notes, so you don’t drift into research you won’t use.",
      ] },
      { id: "country", title: "Know your country", steps: [
        "Write down the basics: its region, its government, its biggest trading partners and the groups it belongs to, such as the African Union or ASEAN.",
        "Find out how the topic affects your country *at home*. A country with a long coastline thinks about rising seas differently from one without.",
        "Find its friends and rivals on this topic. These are the countries you will caucus with, and against.",
      ] },
      { id: "position", title: "Find its position", steps: [
        "Search the UN Digital Library for your country’s name and the topic. *Voting records show what a country actually did*, which matters more than what it said.",
        "Read your country’s speech at the UN General Assembly’s General Debate. It is on the UN website and usually names the issues the country cares about.",
        "Check its foreign ministry’s website for statements on the topic.",
        "Use reliable sources: the UN, governments, and well-known news organisations. If you use Wikipedia, use it to find sources, then read those.",
      ] },
      { id: "paper", title: "Write the paper", text: [
        "Conferences set their own format, length and due date, so check the handbook and the key dates on the conference’s page. If there is no set format, this one works for most:",
      ], steps: [
        "Heading: your country, your committee and the topic.",
        "Background: two or three sentences on the problem and how it affects your country.",
        "Position: what your country believes and what it has done, with one or two facts.",
        "Proposals: two or three specific things your country wants the committee to do. *These become your clauses* on the day.",
        "List your sources at the end. Write it in your own words, as your country, not as yourself.",
      ] },
      { id: "use", title: "Use it on the day", text: [
        "Bring a copy. Your opening speech is your Position paragraph cut to a minute, and your Proposals are what you take into the first unmoderated caucus.",
      ] },
    ],
  },
  {
    slug: "public-speaking", title: "Public speaking and your", accent: "first speech", for: "Delegates", minutes: 5, updated: "2026-11-22",
    lead: "How to structure a speech, a 60-second template, and how to handle points of information.",
    sections: [
      { id: "shape", title: "The shape of a speech", text: [
        "*Every good MUN speech does three things*: says where your country stands, gives one reason or fact, and asks the committee to do something. Anything else is extra.",
        "Address the chair first (“Honourable Chair, fellow delegates”), speak as your country (“Fiji believes”, not “I think”), and end clearly so the chair knows you have finished.",
      ] },
      { id: "template", title: "A 60-second template", steps: [
        "0 to 10 seconds: greet the chair and committee, and name your country.",
        "10 to 30 seconds: your country’s position, and one fact that shows why it matters to you.",
        "30 to 50 seconds: one specific proposal for the committee. Say who would do it and how.",
        "50 to 60 seconds: a closing line, then yield to points of information or to the chair.",
      ] },
      { id: "delivery", title: "Delivery", steps: [
        "Write your first sentence word for word. *Once that is out, the rest is easier.*",
        "Put the rest on a card as dot points, not full sentences, so you look up while you speak.",
        "Speak more slowly than feels normal, and pause after your key fact.",
        "Stand still, with both feet on the floor. Hold the card low.",
        "Put your placard up early. The first few speeches are the easiest, because nobody has used your points yet.",
      ] },
      { id: "poi", title: "Points of information", text: [
        "*Asking one*: stand when the chair calls for points, wait to be chosen, and ask one short question that ends with a question mark. “Does the delegate of Brazil agree that…” works. A speech of your own does not.",
        "*Answering one*: thank the delegate, answer in a sentence or two, and stop. If you don’t know, say your country will be happy to discuss it in caucus. That is a real answer, not a failure.",
        "Whether points of information are allowed, and when, depends on the procedure. In Evatt they come after a speech when the speaker yields to them.",
      ] },
      { id: "practise", title: "Practise", text: [
        "Time yourself out loud at least twice. Collex has a speech timer with practice topics on the Practise page, and it needs no account.",
      ] },
    ],
  },
  {
    slug: "what-to-wear-bring-cost", title: "What to wear, what to bring and", accent: "what it costs", for: "Delegates", minutes: 4, updated: "2026-11-22",
    lead: "For students and parents: dress, a packing list, and where to find the costs.",
    sections: [
      { id: "wear", title: "What to wear", text: [
        "Most Sydney school conferences ask for either *full school uniform* or business attire, such as a blazer or suit jacket, a collared shirt, and formal trousers or a skirt. Each conference sets its own rule, so check its page or the organisers’ email before you buy anything.",
        "Wear shoes you can stand in for a day. Committee rooms can be cold, so bring a layer that fits the dress code.",
      ] },
      { id: "bring", title: "What to bring", steps: [
        "The background guide and your position paper, printed or saved where you can open them without internet.",
        "Your research notes and speech cards.",
        "Pens, paper and sticky notes. Delegates pass a lot of notes.",
        "A laptop and charger, *only if the conference allows devices*. Some are device-free.",
        "Lunch, snacks and a water bottle, unless the conference says food is provided.",
        "Any medication you need, and your signed permission note if your school asks for one.",
      ] },
      { id: "cost", title: "What it costs", text: [
        "*Costs vary a lot.* Some conferences are free, and others charge a fee per delegate or per school delegation. Look for Delegate fee on the conference’s Collex page. If it says to be announced, email the contact on the same page.",
        "Fees are paid to the conference or through your school, never through Collex. Usually a teacher collects them and registers the school’s delegation. Also allow for travel to the venue, food if it is not included, and anything you need for the dress code.",
      ] },
      { id: "parents", title: "For parents", text: [
        "Each conference page has a one-page sheet to print, with the dates, venue, host, contact and a place to sign. The teachers and parents page explains who runs Collex and what it collects about students.",
      ] },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
