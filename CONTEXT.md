# AI Interviewer

An AI interviewer that runs technical practice interviews, currently focused on frontend developers.

## Language

**Interview**:
A single run of questions asked by the AI interviewer, shaped by an Interview Setup.
_Avoid_: Session, quiz

**Interview Setup**:
The choices made before an Interview starts: Seniority Level, Category and Question Count.
_Avoid_: Session config, settings, preferences

**Seniority Level**:
The candidate level an Interview targets: Junior, Mid or Senior. It decides which Questions are eligible and which Expectations a candidate's answer is judged against.
_Avoid_: Difficulty, level

**Category**:
The technical subject an Interview's Questions are drawn from: JavaScript, React, TypeScript or Mixed.
_Avoid_: Topic, subject

**Mixed**:
The Category whose Questions are spread as evenly as possible across all the other Categories. It is never the subject of a single Question.
_Avoid_: Random

**Question**:
A single subject a candidate is asked about, such as the event loop. It belongs to one Category, is available at one or more Seniority Levels, and usually keeps the same wording at every level, though a level may have its own wording.
_Avoid_: Prompt, task

**Expectations**:
What a candidate's answer to a Question must cover at a given Seniority Level. A Senior's Expectations go deeper than a Junior's for the same Question.
_Avoid_: Rubric, model answer

**Question Count**:
The number of questions asked in an Interview, from 5 to 10.
_Avoid_: Length, size
