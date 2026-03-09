"use client";

import { useState } from "react";
import type { UserContext } from "@/lib/auth";
import StudentQuizView from "./StudentQuizView";
import StudentContentRatingView from "./StudentContentRatingView";

type Props = {
  user: UserContext;
};

const tabs = [
  { id: "quiz", label: "Quiz" },
  { id: "ratings", label: "Content Ratings" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function StudentView({ user }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("quiz");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Engage Agent
            </p>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-sky-700">
              Student
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Welcome, <span className="font-semibold text-slate-700">{user.name}</span>
          </p>
        </header>

        <nav className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-[#BA0C2F] text-white"
                  : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "quiz" && <StudentQuizView user={user} />}
        {activeTab === "ratings" && <StudentContentRatingView user={user} />}
      </div>
    </div>
  );
}
