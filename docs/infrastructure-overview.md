# Engage Agent Infrastructure Overview

## Summary

The Engage Agent is a single Next.js application that serves three roles at once: it renders the teacher and student UI, exposes the backend API routes that power the workflow, and orchestrates calls to external services such as OpenAI, x.ai, DynamoDB, S3, and optionally SQS plus Lambda. In production, the main app is hosted on AWS Amplify. The app is designed to be embedded inside the GENIUS Learning Platform through an iframe, where GENIUS passes an SSO JWT token into the Engage Agent. The app verifies that token, decides whether the user is a teacher or student, and then renders the appropriate experience. Most business logic lives in the Next.js API routes under `app/api`, while shared persistence, auth, lesson lookup, and cache logic live in `lib/`.

## Tech Stack

- Frontend framework: Next.js 16 App Router
- UI runtime: React 19
- Language: TypeScript
- Styling: Tailwind CSS 4
- Auth: JWT verification with `jose`
- LLM and image generation: OpenAI API
- Video generation: x.ai `grok-imagine-video`
- Database: DynamoDB, with local JSON fallback for development
- Object storage: S3 for generated images and videos
- Queue: Amazon SQS for async cohort-analysis fan-out
- Background compute: AWS Lambda worker for queued cohort analysis
- Hosting: AWS Amplify for the main Next.js app
- CI/CD: GitHub Actions for Lambda deployment
- Testing: Vitest

## Main Components

### 1. GENIUS Platform Integration

GENIUS is the parent system. It embeds this app in an iframe and passes an SSO token through the URL query string. That token includes fields such as the user ID, role, class ID, class name, assignment ID, and task ID. The Engage Agent verifies the token using a shared `SSO_SECRET`. If the token is valid, the app routes the user into either the teacher or student experience.

### 2. Next.js Application

The Next.js application is the center of the system. It handles both the frontend pages and the backend API endpoints. The frontend is mostly role-driven. Teachers can publish quizzes, review student answers, request strategy analysis, generate content, generate images and videos, and publish content to students. Students can answer quiz questions and rate the content they receive. The backend endpoints support those actions directly, rather than delegating to a separate monolithic backend service.

### 3. API Routes

The API routes under `app/api/` act as the backend surface area. They cover:

- authentication verification
- quiz state management
- student answer submission and retrieval
- single-student strategy generation
- batch and async cohort strategy generation
- text content generation
- image generation and image refinement
- video generation and video polling
- media retrieval and version switching
- content publishing
- content ratings

This means the app server is both the presentation layer and the orchestration layer.

### 4. Shared Library Layer

The shared `lib/` directory centralizes logic that multiple routes use:

- `lib/auth.ts` verifies JWTs and handles fallback-secret verification
- `lib/nosql.ts` abstracts persistence and decides whether to use DynamoDB or local JSON
- `lib/quiz-data.ts` loads the lesson JSON files from the repo
- `lib/lesson-context.ts` transforms raw lesson data and student answers into prompt-ready evidence
- `lib/cohort-analysis-queue.ts` handles SQS message batching
- `lib/strategy-plan-cache.ts` serializes and version-checks cached plans

### 5. Storage

The storage model has two operating modes:

- Production-style mode: DynamoDB is used when `DYNAMODB_TABLE` is configured
- Local development mode: a JSON file at `data/engage-nosql.json` is used when DynamoDB is not configured

This fallback makes the project easy to run locally without requiring cloud infrastructure.

### 6. Media Storage

Generated images and videos may be too large for DynamoDB, so the app prefers storing large media in S3 if `ENGAGE_S3_BUCKET` is configured. The database stores the metadata and S3 key, and the app generates presigned URLs when reading media back. If S3 is not configured, the system will try to store media inline, but only if the payload is small enough to fit within DynamoDB limits.

### 7. Async Worker

Large cohort analysis can run asynchronously. When `COHORT_ANALYSIS_QUEUE_URL` is configured, the app creates a job record, sends one SQS message per student, and a Lambda worker processes those records. The worker reads the same lesson data bundled into its deployment package, checks the strategy cache, calls OpenAI only when needed, writes student results back to DynamoDB, and updates job counters. The teacher UI polls the job-status endpoint until the work is complete.

## ASCII Architecture Diagram

```text
                         +----------------------+
                         |  GENIUS Platform     |
                         |  (parent system)     |
                         +----------+-----------+
                                    |
                                    | iframe + sso_token JWT
                                    v
+-------------------------------------------------------------------+
| AWS Amplify Hosting                                                |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | Next.js App (UI + API routes)                              |  |
|  |                                                             |  |
|  |  React UI                                                   |  |
|  |  - TeacherView                                              |  |
|  |  - StudentView                                              |  |
|  |                                                             |  |
|  |  API routes                                                 |  |
|  |  - /api/auth/verify                                         |  |
|  |  - /api/quiz-status                                         |  |
|  |  - /api/student-answers                                     |  |
|  |  - /api/strategy-*                                          |  |
|  |  - /api/engagement-content                                  |  |
|  |  - /api/engagement-image                                    |  |
|  |  - /api/engagement-video                                    |  |
|  |  - /api/content-publish / content-rating / media            |  |
|  +--------------------+----------------------------------------+  |
|                       |                                           |
+-----------------------|-------------------------------------------+
                        |
                        | uses server-side libs
                        v
             +---------------------------+
             | Auth + Domain Layer       |
             | - lib/auth.ts             |
             | - lib/lesson-context.ts   |
             | - lib/quiz-data.ts        |
             | - lib/nosql.ts            |
             +------------+--------------+
                          |
          +---------------+------------------+
          |                                  |
          |                                  |
          v                                  v
+--------------------------+       +-----------------------------+
| OpenAI APIs              |       | x.ai Video API              |
| - strategy generation    |       | - animate still image       |
| - text content           |       |   into short video          |
| - image generation/edit  |       +-----------------------------+
+--------------------------+

Persistence path
----------------
          +----------------------------------------------+
          | DynamoDB single table                        |
          | stores:                                      |
          | - quiz status                                |
          | - student answers                            |
          | - plan cache                                 |
          | - published content                          |
          | - ratings                                    |
          | - media metadata                             |
          | - cohort job + student job results           |
          +-------------------+--------------------------+
                              |
                              | media payloads
                              v
                       +--------------+
                       | S3 Bucket    |
                       | images/video |
                       +--------------+

Async cohort analysis path
--------------------------
Teacher clicks "analyze cohort"
        |
        v
/api/strategy-job
        |
        | create job in DynamoDB
        | enqueue 1 SQS message per student
        v
   +-----------+
   |   SQS     |
   +-----+-----+
         |
         v
+---------------------------+
| Lambda worker             |
| cohort-analysis-worker    |
| - reads lesson data       |
| - checks cached plan      |
| - calls OpenAI if needed  |
| - writes result to DB     |
| - updates job counters    |
+-------------+-------------+
              |
              v
      DynamoDB job records
              |
              v
/api/strategy-job/[jobId]
              |
              v
Teacher UI polls progress/results
```

## Step-By-Step Runtime Flow

### Authentication and Role Resolution

1. GENIUS loads the app in an iframe and passes `sso_token`.
2. The browser-side auth provider reads the token from the URL.
3. The frontend posts the token to `/api/auth/verify`.
4. The server verifies the JWT using `SSO_SECRET`, and optionally `SSO_FALLBACK_SECRET`.
5. The verified payload becomes the user context.
6. The app renders the teacher or student view based on the `role` field.

### Student Quiz Flow

1. The teacher publishes a quiz for a lesson.
2. Quiz status is stored by class and assignment.
3. Students submit answers through `/api/student-answers`.
4. The answers are persisted in DynamoDB or the local JSON fallback store.
5. Teachers later retrieve those answers to drive strategy generation.

### Strategy Generation Flow

The strategy system is prompt-based but constrained by lesson data and quiz evidence. The app does not simply send raw student answers and ask the model for an opinion. Instead, it first resolves structured quiz evidence from the lesson definition. That means the system maps each answer to the question stem, selected option, correct answer, correctness, confidence response, and misconception metadata. That evidence is then embedded into a structured prompt so the model reasons from a normalized representation rather than from sparse answer keys alone.

For one student, `/api/strategy-single` checks whether a cached plan already exists. If a valid cached plan is present, the app returns it. If not, it calls OpenAI with a prompt that asks for JSON only and requires a specific schema. The schema includes a named strategy, a relevance map over four possible strategies, a teacher-facing recommendation, a rationale, tactics, cadence, and quick checks.

For a cohort, the system first tries to reuse cached plans for any students who already have them. Then it branches:

- If the queue is configured, it starts a cohort job, enqueues one SQS message per student, and polls for results.
- If the queue is not configured, it falls back to synchronous batch processing inside the Next.js route.

This is an important design decision: the app degrades gracefully. Local development and lightly provisioned environments can still function without provisioning SQS or Lambda.

### Content Generation Flow

After strategies are selected, `/api/engagement-content` asks OpenAI to generate exactly one student-facing content item per selected strategy. The prompt is constrained so the output stays aligned to the lesson objective and remains appropriate for middle-school learners. The response must be JSON and must include the text content plus a short `visualBrief` that later guides the image-generation prompt.

### Image Generation Flow

The image route builds a lesson-aware, strategy-aware prompt from the selected content item. It tells the model to create a simple, classroom-friendly illustration with zero text. That zero-text rule is enforced very explicitly in the prompt by forbidding words, letters, equations, labels, watermarks, and similar artifacts. If the teacher refines an image, the route can first send the marked-up image plus the user’s instruction to a vision-capable model to rewrite the instruction into a cleaner edit prompt that describes what should change spatially and what should remain untouched. The resulting image is then stored in S3 or DynamoDB, versioned, and made available through the media API.

### Video Generation Flow

The video path is a two-step process. First, `/api/engagement-video` sends the still image URL to x.ai with a constrained animation prompt that requests natural motion only, no narration, and no text. Then the frontend polls `/api/engagement-video/status` until the remote job is done. Once the video URL is available, the app downloads the video, persists it to S3 or inline storage, and returns a durable URL for the UI.

### Publishing and Rating Flow

When the teacher publishes content, `/api/content-publish` stores the content payload and merges in any associated media URLs. Students retrieve the published content and later submit ratings through `/api/content-rating`. This keeps the engagement loop closed: teacher publishes, student consumes, student rates, and the app retains that feedback.

## Deployment Model

### Main App Deployment

The main application is deployed through AWS Amplify. The `amplify.yml` file installs dependencies, writes the required environment variables into `.env.production`, and runs `npm run build`. Amplify then hosts the built Next.js application.

### Worker Deployment

The cohort-analysis worker is packaged by a shell script that copies the worker entrypoint, production dependencies, and all lesson JSON files into a zip archive. A second deploy script updates the Lambda function code with the AWS CLI. A GitHub Actions workflow automates that update on pushes to `main` when the worker code, lesson files, or worker deploy scripts change.

This split is intentional:

- Amplify hosts the interactive web app
- Lambda handles background queue processing
- GitHub Actions updates only the worker code

That keeps the heavy async processing separate from the UI-serving environment.

## Data Model and Storage Decisions

The storage layer uses a single DynamoDB table with composite keys. Records are distinguished by prefixes such as plan cache, quiz status, student answer, content publish, rating, media, and cohort job. This is a common serverless pattern because it keeps operational overhead low and allows multiple entity types to coexist in one table. The code only queries the primary key patterns needed for the current flows, so the table does not require a large set of secondary indexes for the current design.

Media is handled differently from text records because of DynamoDB’s item-size limit. The app therefore stores large binary payloads in S3 and keeps pointers in DynamoDB. When media is read, the app generates presigned URLs so the browser can access the object without exposing a permanently public asset.

The local JSON fallback exists because the team wanted a development workflow that can run with minimal setup. If AWS variables are absent, the app still works, which lowers friction for local testing and UI iteration.

## Prompting, Decision-Making, and Algorithms

The system’s algorithmic approach is mostly deterministic orchestration wrapped around LLM calls. The important pattern is that the model is never the only source of structure. The app first extracts structure from lesson data and quiz answers, then asks the model to operate inside that structure. For strategy generation, the algorithm resolves each multiple-choice answer into correctness, confidence, and misconception context before building the prompt. That prompt insists on a fixed JSON output shape and restricts the valid strategy labels to exactly four options: cognitive conflict, analogy, experience bridging, and engaged critiquing. The relevance field forces the model to produce a score across all four options, which helps the UI compare choices. The recommendation and rationale sections are explicitly required to cite concrete student evidence, which is a guardrail against vague motivational advice. The app also caches the resulting plan, including a prompt-version and lesson-number check, so future requests can avoid unnecessary model calls and invalidate stale cache entries when prompt assumptions change. Cohort analysis uses the same basic plan-generation logic but applies it across students either in small concurrent batches in-process or one student per queue message in the Lambda worker. That fan-out strategy is a deliberate operational decision: each student becomes an isolated work unit, which makes retries cleaner, lets progress be tracked incrementally, and avoids losing an entire cohort job because one student request fails. Content generation follows a similarly constrained pattern: the model is told to return exactly one student-facing item, to avoid teacher-facing language, to stay anchored to the lesson objective, and to produce a `visualBrief` for downstream image generation. Image prompting then converts the lesson, strategy, title, body, and visual brief into a scene description while explicitly banning visible text, labels, equations, and watermarks. For refinement, the app optionally uses a vision model to transform a user’s rough instruction plus an annotated image into a more spatially precise editing prompt, because users are often better at pointing to a region than at describing it precisely. Video generation is intentionally simpler: it reuses the generated image as the anchor frame and asks x.ai for subtle, plausible motion only, reducing the risk of the video drifting away from the educational scene. Across the system, the general decision-making approach is consistent: prefer cached work when valid, prefer structured evidence over raw text, prefer constrained JSON outputs over free-form prose, prefer async fan-out when work may be slow or numerous, and preserve a synchronous fallback path so the product still works when optional infrastructure is absent.

## Short Takeaway

This infrastructure is not a large microservice fleet. It is a pragmatic serverless-style architecture centered on one Next.js app, with cloud services added only where they materially help:

- Amplify serves the app
- Next.js handles the UI and API orchestration
- DynamoDB stores structured records
- S3 stores large generated media
- OpenAI and x.ai provide generation capabilities
- SQS and Lambda handle scalable cohort-analysis background work
- local JSON fallback keeps development simple

That balance is the main design philosophy of the project.

## End-to-End Generation Lifecycle

The practical product flow is slightly broader than the pure "generation" phase, so it is helpful to describe it as a full loop with generation in the middle.

### Phase 0: Quiz Capture

The workflow begins with the quiz, because the rest of the pipeline depends on that evidence. The teacher publishes or opens a quiz for a lesson, and each student submits responses to `/api/student-answers` with `classId`, `assignmentId`, `studentId`, `lessonNumber`, and the answer map. Those submissions are stored in DynamoDB or the local JSON fallback, along with `student_name` and `submitted_at`. When recommendation generation runs later, the app does not rely only on raw answer IDs. It uses `lib/lesson-context.ts` to join the saved answers with lesson metadata so the system can reason over question text, selected option, confidence, correctness, and misconception context.

### The 3-Step Generation Process

The actual generation pipeline has three steps:

1. **Generate a recommendation for each student.**  
   The app calls `/api/strategy-single` for one learner or `/api/strategy-batch` and `/api/strategy-job` for many learners. For each student, the server checks the plan cache first. If no valid cached plan exists, it prompts OpenAI for a strict JSON plan containing the selected strategy, relevance scores across all four supported strategies, a teacher-facing recommendation, a reason, rationale, tactics, cadence, and checks. Each student recommendation is stored back in the cache so repeated runs can avoid another model call.

2. **Roll those recommendations up to the whole cohort.**  
   After student-level plans are generated, the system builds a cohort view by counting how many students landed in each strategy bucket. In the synchronous batch route this is returned as `distribution`; in the async queue path the worker writes per-student results and job progress so the teacher UI can poll until the cohort analysis is complete. This cohort step is important because the teacher is not only choosing an intervention for one student; they can also see the pattern across the class before deciding what material to prepare.

3. **Generate materials from the selected strategy or strategies.**  
   Once the teacher chooses which strategy to act on, `/api/engagement-content` generates exactly one student-facing content item per selected strategy. The output includes the content text plus a `visualBrief`. That content can then feed `/api/engagement-image` for an illustration and `/api/engagement-video` for optional animation. The generated media is stored in S3 when configured, with metadata and durable references stored in the database.

### Phase 4: Publish and Student Rating

After generation, the teacher publishes the final material through `/api/content-publish`. Students then consume the published content and submit feedback through `/api/content-rating`, which records `classId`, `assignmentId`, `studentId`, `contentItemId`, a numeric `rating` from 1 to 5, and `rated_at`. That rating step closes the instructional loop: the system starts from quiz evidence, generates recommendations and materials, and then captures student response data about the material that was actually delivered.

### Short Version of the Full Loop

In compact form, the operational sequence is:

1. Quiz responses are collected per student.
2. A recommendation is generated for each student.
3. Those recommendations are summarized at the cohort level.
4. Student-facing materials are generated from the chosen strategy.
5. The material is published and students rate it.

### Teacher Step-by-Step Usage Flow

From the teacher's perspective, the product is designed to support preparation before class and active use during class.

#### Before Class

1. The teacher sends the quiz to the whole class before the lesson.
2. Students answer the quiz prior to class, and their responses are stored under the current class, assignment, and lesson.
3. Before class begins, the teacher reviews the returned quiz evidence and generates recommendations for individual students and for the class as a whole.
4. The teacher then selects one or more strategies to act on and generates the student-facing materials before class, including text content and optional images or video.

This pre-class workflow is important because the recommendations and materials are not meant to be improvised live from scratch. The system is designed so the teacher can come into class with a prepared, evidence-based engagement plan already ready to share.

#### During Class

1. During the live lesson, the teacher clicks Share and publishes the prepared material to students.
2. Students view the shared material in class.
3. The teacher can use that material to support small-group discussion, partner talk, or whole-class discussion, depending on the lesson structure.
4. After students engage with the material, they submit a rating for it through the student experience.

This means the instructional loop is intentionally split across time:

- **Before class:** collect quiz evidence, generate recommendations, and prepare materials.
- **During class:** share the prepared materials, facilitate discussion, and gather student ratings.

That teacher workflow matches the technical pipeline described above: quiz first, recommendation generation second, cohort synthesis third, material generation fourth, classroom sharing fifth, and student rating last.
