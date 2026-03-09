# Engage Agent

An AI-driven engagement tool for educators. Teachers select a lesson, publish a
quiz to students, review answers, generate engagement strategies, create
content (text, images, video), and send selected content to students. Students
answer quiz questions and rate the content they receive.

The Engage Agent is designed to be embedded inside the
[GENIUS Learning Platform](https://github.com/AI4STEM-Education-Center/GENIUS_Learning_Platform)
via an iframe with SSO authentication, but can also run standalone for
development.

## Features

- **Teacher workflow** (3 steps): publish quiz → review answers & generate
  strategies → generate & send content
- **Student workflow**: answer quiz questions, then rate published content
- Lesson data for 8 physics lessons (collisions & forces) with multiple-choice
  and confidence-check items
- Strategy generation using batch/cohort analysis of student answers
- Content generation with AI-generated images and video
- Role-based views determined by SSO token (`teacher` vs `student`)
- Local JSON store or DynamoDB for persistence

## Architecture

- **Framework**: Next.js 16 (App Router)
- **API routes**: `app/api/` — auth, lessons, quiz status, student answers,
  content publish, content rating, strategy, media generation
- **Data layer**: `lib/nosql.ts` — DynamoDB with local JSON fallback
- **Auth**: `lib/auth.ts` — JWT (HS256) verification via `jose`
- **Quiz data**: `lib/quiz-data.ts` — loads `docs/data/lesson1-8.json`
- **Tests**: `__tests__/` — 57 tests via Vitest

## Prerequisites

- Node.js 18+
- npm
- (Optional) MongoDB and the GENIUS Learning Platform for full integration

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` or create `.env` in the project root:

```bash
# Required
OPENAI_API_KEY=your_key_here

# SSO (must match the GENIUS Learning Platform secret)
SSO_SECRET=your_shared_sso_secret

# Origins allowed to embed this app in an iframe (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000

# Optional — AI model overrides
OPENAI_MODEL=gpt-5-nano
OPENAI_IMAGE_MODEL=gpt-image-1

# Optional — DynamoDB (uses local JSON store if not set)
# Use ENGAGE_ prefix to avoid Next.js reserved "AWS" prefix
ENGAGE_AWS_REGION=us-east-1
ENGAGE_AWS_ACCESS_KEY_ID=your_access_key
ENGAGE_AWS_SECRET_ACCESS_KEY=your_secret_key
DYNAMODB_TABLE=engage_strategy_cache
```

### 3. Run the development server

```bash
npm run dev
```

The app starts on `http://localhost:3000` (or `:3001` if 3000 is taken).

### 4. Run tests

```bash
npm test            # single run
npm run test:watch  # watch mode
```

## Running with the GENIUS Learning Platform

To test the full SSO + iframe integration you need three processes running:

| Terminal | Command | What it runs |
|----------|---------|--------------|
| 1 | `mongod --dbpath /usr/local/var/mongodb` | MongoDB (or `brew services start mongodb-community`) |
| 2 | `cd GENIUS_Learning_Platform && npm run dev:full` | Genius Platform — Next.js (:3000) + Express (:4000) |
| 3 | `cd uga-engage-agent && npm run dev` | Engage Agent (:3001) |

Once all three are running:

1. Open `http://localhost:3000` and log in to the Genius Platform as a teacher
2. Create a Learning Task that points to the Engage Agent URL
   (`http://localhost:3001`)
3. Assign the task to a class
4. Open the assignment — the Engage Agent loads in an iframe with an SSO token
   and shows the **Teacher View**
5. Log in as a student in the same class and open the assignment to see the
   **Student View** (quiz + content ratings)

### SSO details

The GENIUS Platform signs a JWT (HS256) with `SSO_SECRET` and passes it to the
Engage Agent via `?sso_token=<JWT>` in the iframe URL. The token payload
includes `sub`, `email`, `name`, `role`, `classId`, `className`,
`assignmentId`, and `taskId`. The Engage Agent verifies the token and routes to
the appropriate view based on the `role` field.

The `SSO_SECRET` is shared across all agents that connect to the Genius
Platform — you do not need a separate secret per agent.

## DynamoDB table schema

Create a table named `engage_strategy_cache` (or your chosen `DYNAMODB_TABLE`)
with:

- **Partition key**: `class_id` (String)
- **Sort key**: varies by record type (`ASSIGN#...`, `PLAN#...`, `MEDIA#...`,
  `QUIZ_STATUS#...`, `ANSWER#...`, `CONTENT_PUB#...`, `RATING#...`)
- **GSI** `student-index`: partition key `student_id` (String), sort key
  `updated_at` (String)
