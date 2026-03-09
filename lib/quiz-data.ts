import type { Lesson } from "./types";

import lesson1 from "@/data/lesson1.json";
import lesson2 from "@/data/lesson2.json";
import lesson3 from "@/data/lesson3.json";
import lesson4 from "@/data/lesson4.json";
import lesson5 from "@/data/lesson5.json";
import lesson6 from "@/data/lesson6.json";
import lesson7 from "@/data/lesson7.json";
import lesson8 from "@/data/lesson8.json";

const lessons: Lesson[] = [
  lesson1 as Lesson,
  lesson2 as Lesson,
  lesson3 as Lesson,
  lesson4 as Lesson,
  lesson5 as Lesson,
  lesson6 as Lesson,
  lesson7 as Lesson,
  lesson8 as Lesson,
];

export function getAllLessons(): Lesson[] {
  return lessons;
}

export function getLesson(lessonNumber: number): Lesson | null {
  return lessons.find((l) => l.lesson_number === lessonNumber) ?? null;
}

export function getLessonQuizItems(lessonNumber: number) {
  const lesson = getLesson(lessonNumber);
  if (!lesson) return [];
  return lesson.quiz_items;
}
