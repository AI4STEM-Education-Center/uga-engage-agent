# Engage Agent Prototype

This demo showcases an AI-assisted engagement workflow for educators. It guides
students through a short questionnaire, recommends an engagement strategy, then
generates aligned classroom content and a supporting illustration. The goal is
to demonstrate how student responses can drive personalized engagement plans and
content in a single, end-to-end experience.

## What the demo covers

- Student questionnaire with mock responses for quick testing
- Strategy recommendations with a rationale and tactics
- Cohort analysis to compare strategies across multiple students
- Content generation (warm-up, mini lesson, practice)
- Image generation aligned to the content
- Simple caching of strategy results in a local NoSQL JSON store or DynamoDB

## Backend location

The backend is implemented as Next.js API routes under `app/api`, with shared
data helpers in `lib`. Caching lives in `data/engage-nosql.json` unless
DynamoDB is configured.

## Getting started

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
OPENAI_API_KEY=your_key_here
# Optional
OPENAI_MODEL=gpt-5-nano
OPENAI_IMAGE_MODEL=gpt-image-1

# Optional DynamoDB cache (uses local JSON store if not set)
# Use ENGAGE_ prefix to avoid Next.js reserved "AWS" prefix
ENGAGE_AWS_REGION=us-east-1
ENGAGE_AWS_ACCESS_KEY_ID=your_access_key
ENGAGE_AWS_SECRET_ACCESS_KEY=your_secret_key
DYNAMODB_TABLE=engage_strategy_cache
```

## DynamoDB table schema

Create a table named `engage_strategy_cache` (or your chosen
`DYNAMODB_TABLE`) with a partition key:

- `student_id` (String)

Items store `plan_json` (String) and `updated_at` (String ISO timestamp).

3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the demo.
