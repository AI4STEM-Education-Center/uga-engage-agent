# EngageAgent Components and Human-Agent Interactions

## Purpose

This document explains EngageAgent in plain language. It focuses on the main parts of the product, who uses them, and how people interact with the system step by step.

The goal is to help non-technical readers understand how EngageAgent supports a teacher before class, during class, and after students respond.

## Who Is Involved

There are three main participants in the EngageAgent workflow:

### 1. Teacher

The teacher is the main decision-maker. The teacher starts the process by assigning a quiz, reviews the results, asks EngageAgent for recommendations, chooses which ideas to use, and shares the final material with students.

### 2. Student

The student provides the learning evidence. Students answer the quiz, view the material that the teacher shares, and rate how helpful or engaging that material was.

### 3. EngageAgent

EngageAgent is the support system. It does not replace the teacher. Instead, it helps the teacher interpret quiz results, suggests instructional strategies, generates student-facing materials, and records what happened so the teacher can respond more effectively.

## Main Components of EngageAgent

Below are the major parts of the system explained in everyday terms.

### 1. Sign-In and Class Context

This part makes sure the right person sees the right experience.

- If the user is a teacher, EngageAgent shows teacher tools.
- If the user is a student, EngageAgent shows the student experience.
- It also knows which class, assignment, and lesson the user is working in.

For a non-technical reader, this component answers the question: "Who is using the system right now, and what class are they in?"

### 2. Quiz Response Capture

This component collects student answers.

- The teacher makes a quiz available for a lesson.
- Students submit their answers.
- EngageAgent saves those answers so they can be used later.

This is the starting point for everything else. Without quiz responses, the system has no evidence to analyze.

### 3. Lesson Understanding Layer

This part connects student answers to the actual lesson content.

Instead of only seeing that a student picked "B" or "C," EngageAgent connects each answer to the question text, the selected option, whether the answer was correct, and any lesson-specific context tied to that question.

This matters because it helps the system base its recommendations on what the student likely understood or misunderstood, not just on a raw answer choice.

### 4. Recommendation Engine

This is the part most people think of as the "agent."

After quiz evidence is available, EngageAgent can generate a recommendation for one student or for many students. It looks at the quiz evidence and suggests an instructional approach that may help the learner engage more effectively.

The output is written for teacher use. It can include:

- the recommended strategy
- why that strategy fits the student
- practical teaching moves or tactics
- a short explanation the teacher can act on

The system helps with analysis, but the teacher still decides what to do next.

### 5. Cohort View

This component helps the teacher look at the whole class, not just one student.

After individual recommendations are created, EngageAgent can summarize the class-level pattern. For example, it can show how many students are leaning toward one type of support versus another.

This helps the teacher answer questions like:

- "Is this one student issue or a broader class pattern?"
- "Should I prepare one activity for many students or different supports for smaller groups?"

### 6. Content Generator

This part creates student-facing material based on the strategy the teacher selects.

Once the teacher chooses a direction, EngageAgent can generate a piece of content for students to view or discuss. This may include the main text of the activity and a description of what an image or visual should show.

This means the system does not stop at analysis. It helps move from diagnosis to actual classroom material.

### 7. Image and Video Generation

This optional component turns the selected content into richer media.

- An image can be generated from the visual description.
- A short video can be generated from the image or content concept.

These media pieces are supporting materials. They are meant to help the teacher present the strategy in a more engaging way, not to replace the teacher's lesson.

### 8. Publishing and Sharing

This component lets the teacher send the final material to students.

The important point here is control: EngageAgent does not automatically publish material to students on its own. The teacher reviews the generated output and then decides when to share it.

### 9. Student Rating and Feedback Capture

After students view the material, they can rate it.

This creates a feedback loop. The system starts with student quiz evidence, supports the teacher in creating an intervention, and then captures student reaction to the material that was actually used.

That feedback can help the teacher reflect on whether the generated content was useful.

## Human-Agent Interaction Model

The easiest way to understand EngageAgent is to see it as a partnership between people and an AI-supported tool.

### What the Teacher Does

- chooses when to assign the quiz
- decides when to generate recommendations
- reviews the recommendations
- selects which strategy to use
- reviews generated materials
- decides what to publish
- uses the material during instruction

### What the Student Does

- answers the quiz
- receives the published material
- engages with the lesson activity
- rates the material afterward

### What EngageAgent Does

- organizes quiz evidence
- interprets responses in lesson context
- generates recommendations
- summarizes patterns across the class
- creates draft materials from the chosen strategy
- stores records of what was submitted, generated, published, and rated

### What EngageAgent Does Not Do

- it does not replace teacher judgment
- it does not decide classroom instruction on its own
- it does not publish materials without the teacher
- it does not create learning evidence unless students first provide it

## Step-by-Step Interaction Flow

The sections below describe the workflow in the order a non-technical user would experience it.

### Phase 1: Teacher Prepares the Quiz

1. The teacher opens the lesson and makes the quiz available to students.
2. EngageAgent records that the quiz is now active for that class and assignment.
3. Students are now able to respond.

Human-agent interaction:

- The teacher starts the process.
- EngageAgent simply makes the quiz workflow available and keeps track of the lesson context.

### Phase 2: Students Submit Answers

1. Each student opens the quiz.
2. The student answers the lesson questions.
3. EngageAgent saves each submission.
4. The teacher can later review the collected responses.

Human-agent interaction:

- The student provides the evidence.
- EngageAgent captures and stores that evidence.
- The teacher does not yet receive recommendations at this stage.

### Phase 3: EngageAgent Interprets the Quiz Evidence

1. EngageAgent connects each saved answer to the lesson question it belongs to.
2. It interprets the answer in context, such as what the question asked and whether the response was correct.
3. It prepares that information so recommendation generation can be more meaningful.

Human-agent interaction:

- This is mostly a behind-the-scenes support step.
- The system is turning quiz submissions into something the teacher can use.

### Phase 4: The Teacher Requests Recommendations

1. The teacher asks EngageAgent to analyze one student or the whole class.
2. EngageAgent reviews the quiz evidence.
3. It generates a recommendation for each student being analyzed.
4. If the teacher requested a class-wide analysis, EngageAgent also summarizes the overall distribution of recommendations.

Human-agent interaction:

- The teacher asks a professional question: "What support might help these learners?"
- EngageAgent returns a structured suggestion, not a final decision.

### Phase 5: The Teacher Reviews and Chooses a Strategy

1. The teacher reads the recommendation.
2. The teacher considers whether the suggested strategy fits the upcoming lesson.
3. The teacher chooses one strategy to act on, or selects more than one if needed.

Human-agent interaction:

- This is one of the most important checkpoints.
- The agent recommends.
- The teacher decides.

### Phase 6: EngageAgent Generates Student-Facing Material

1. After the teacher selects a strategy, EngageAgent creates the classroom material.
2. The material may include explanatory text, prompts, or discussion-ready content.
3. It may also include a visual description that can be used to create an image.

Human-agent interaction:

- The teacher provides the instructional direction.
- EngageAgent turns that direction into a draft resource.

### Phase 7: Optional Media Is Created

1. The teacher can choose to generate an image.
2. The teacher can optionally generate a short video as well.
3. EngageAgent stores these generated assets so they can be used later.

Human-agent interaction:

- The teacher chooses whether richer media is needed.
- EngageAgent produces the media only when asked.

### Phase 8: The Teacher Publishes the Final Material

1. The teacher reviews the generated material.
2. When ready, the teacher clicks Share or Publish.
3. EngageAgent makes that material available to students.

Human-agent interaction:

- The teacher stays in control of what students actually see.
- EngageAgent handles delivery after the teacher approves it.

### Phase 9: Students Use the Material During Class

1. Students open the shared material.
2. They read, view, or discuss it during the lesson.
3. The teacher uses that material to guide discussion, group work, or reflection.

Human-agent interaction:

- The material supports the live lesson.
- The teacher remains the facilitator of learning.
- The agent is now supporting the classroom indirectly through the prepared resource.

### Phase 10: Students Rate the Material

1. After using the material, students submit a rating.
2. EngageAgent saves that rating.
3. The teacher can use those responses as feedback about how the material landed with students.

Human-agent interaction:

- Students respond to the teacher's chosen intervention.
- EngageAgent records the outcome so the loop is complete.

## Simple End-to-End Summary

In plain language, EngageAgent works like this:

1. The teacher gives a quiz.
2. Students answer it.
3. EngageAgent studies the answers in lesson context.
4. The teacher asks for recommendations.
5. EngageAgent suggests strategies.
6. The teacher chooses what to use.
7. EngageAgent creates materials to match that choice.
8. The teacher shares the final material with students.
9. Students engage with it and rate it.

This makes EngageAgent a decision-support and content-support tool, not an autopilot system.

## Why This Matters for Non-Technical Readers

For a non-technical audience, the most important idea is simple:

EngageAgent helps the teacher move from student evidence to instructional action in a guided sequence.

It does this by supporting four practical classroom needs:

1. collecting evidence from students
2. helping the teacher interpret that evidence
3. helping the teacher prepare a response
4. capturing feedback after the response is used

At every major step, the teacher remains in control, students provide the real classroom evidence, and EngageAgent acts as a structured assistant.
