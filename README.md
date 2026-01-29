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
- Simple caching of strategy results in SQLite

## Backend location

The backend is implemented as Next.js API routes under `app/api`, with shared
data helpers in `lib`. Caching lives in `data/engage.sqlite`.

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
```

3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the demo.
