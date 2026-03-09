export type EngagementStrategy = {
  id: string;
  label: string;
  description: string;
  color: string;
  ring: string;
};

export const engagementStrategies: EngagementStrategy[] = [
  {
    id: "cognitive conflict",
    label: "Cognitive Conflict",
    description: "Challenges a student’s current belief with surprising evidence so they rethink the concept.",
    color: "bg-violet-500",
    ring: "ring-violet-400",
  },
  {
    id: "analogy",
    label: "Analogy",
    description: "Explains a new idea by comparing it to something students already know well.",
    color: "bg-sky-500",
    ring: "ring-sky-400",
  },
  {
    id: "experience bridging",
    label: "Experience Bridging",
    description: "Connects the lesson to students’ own experiences, culture, or everyday situations.",
    color: "bg-emerald-500",
    ring: "ring-emerald-400",
  },
  {
    id: "engaged critiquing",
    label: "Engaged Critiquing",
    description: "Asks students to evaluate claims, evidence, and reasoning so they refine their thinking.",
    color: "bg-amber-500",
    ring: "ring-amber-400",
  },
];

export const getEngagementStrategyLabel = (strategyId: string) =>
  engagementStrategies.find((strategy) => strategy.id === strategyId)?.label ?? strategyId;

export const getEngagementStrategyDescription = (strategyId: string) =>
  engagementStrategies.find((strategy) => strategy.id === strategyId)?.description ?? "No description available yet.";
