# AI Interviewer

An AI interviewer that runs technical practice interviews, currently focused on frontend developers.

## Language

**User**:
The signed-in person who takes Interviews. A User has many Interviews, at most one of them in progress.
_Avoid_: Candidate

**Interview**:
A single run of questions asked by the AI interviewer to one User, shaped by an Interview Setup. All of its Interview Questions are chosen when it starts, but the User sees each one only after answering the one before. An Interview is in progress until it is completed (every Interview Question answered) or abandoned (the User gives it up to start another).
_Avoid_: Session, quiz

**Interview Question**:
A Question as it appears in one Interview: its position, plus the Question Text and Key Points it had when the Interview started. Later changes to the Question don't affect it.
_Avoid_: Asked question, turn

**Interview Setup**:
The choices made before an Interview starts: Seniority Level, Category and Question Count.
_Avoid_: Session config, settings, preferences

**Seniority Level**:
The level an Interview targets: Junior, Mid or Senior. It decides which Questions are eligible and which Question Variant is asked.
_Avoid_: Difficulty, level

**Category**:
The technical subject an Interview's Questions are drawn from: JavaScript, React, TypeScript or Mixed.
_Avoid_: Topic, subject

**Mixed**:
The Category whose Questions are spread as evenly as possible across all the other Categories. It is never the subject of a single Question.
_Avoid_: Random

**Question**:
A single subject a User is asked about, such as the event loop. It belongs to one Category and is either levelled or level-agnostic. A levelled Question has one Question Variant for each Seniority Level it is available at. A level-agnostic Question has one Question Variant, used at every Seniority Level.
_Avoid_: Prompt, task

**Explanation**:
The complete write-up of a Question's subject, shared by all Seniority Levels. It covers every Key Point the Question assesses at any level, and can be read on its own as learning material.
_Avoid_: Reference answer, ideal answer, model answer

**Question Text**:
The sentence the AI interviewer says to ask a Question. A Question has a default Question Text, and a Question Variant may replace it with its own.
_Avoid_: Wording, prompt

**Question Variant**:
The form a Question takes at a Seniority Level: the Key Points a User's answer must cover there, plus an optional Question Text of its own. Each Variant lists all of its Key Points; it inherits none from lower levels. A Senior Variant goes deeper than a Junior one for the same Question.
_Avoid_: Expectations, rubric, bar

**Key Point**:
A single essential idea that a User's answer must contain, as listed in a Question Variant. Every Key Point is essential; there are no optional ones. A Key Point the User covers only in reply to a Follow-up Question still counts, but is marked as prompted.
_Avoid_: Criterion, checkpoint, bonus point

**Answer**:
The User's spoken reply to an Interview Question or to a Follow-up Question, kept as the text of what they said.
_Avoid_: Response, reply

**Follow-up Question**:
A question the AI interviewer comes up with during the Interview, based on the User's answer to a Question. A Question gets at most 3 of them, and they don't count toward the Question Count.
_Avoid_: Sub-question, probe

**Question Count**:
The number of questions asked in an Interview, from 5 to 10.
_Avoid_: Length, size
