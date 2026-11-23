import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  Volume2,
  RefreshCw,
} from "lucide-react";
import type { Priority, TaskItem, TaskStatus } from "../types";

interface PlannerPanelProps {
  tasks: TaskItem[];
  onAddTask: (task: {
    title: string;
    description: string;
    category: string;
    priority: Priority;
    estimated_minutes: number;
    depends_on_id: number | null;
  }) => void;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onDeleteTask: (id: number) => void;
  onAutoPlan: (startNow: boolean) => void;
  onSpeakPlan: () => void;
}

const PRIORITY_BADGE: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: "জরুরি", cls: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  high: { label: "উচ্চ", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  normal: { label: "সাধারণ", cls: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  low: { label: "কম", cls: "bg-slate-700/60 text-slate-300 border-slate-600" },
};

export const PlannerPanel: React.FC<PlannerPanelProps> = ({
  tasks,
  onAddTask,
  onStatusChange,
  onDeleteTask,
  onAutoPlan,
  onSpeakPlan,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("অফিস");
  const [priority, setPriority] = useState<Priority>("high");
  const [minutes, setMinutes] = useState(45);
  const [dependsOn, setDependsOn] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      estimated_minutes: minutes,
      depends_on_id: dependsOn ? Number(dependsOn) : null,
    });
    setTitle("");
    setDescription("");
    setDependsOn("");
  };

  const pendingTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">অফিস টাস্ক ও অটো-প্ল্যানার</h2>
          <p className="text-xs text-slate-400">
            কোন কাজের পর কোনটা করবেন—অ্যাসিস্ট্যান্ট নিজে থেকে সময় ও ক্রম সাজিয়ে দেবে
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAutoPlan(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer transition"
          >
            <Sparkles className="w-4 h-4" />
            নিজে থেকে প্ল্যান বানাও
          </button>
          <button
            type="button"
            onClick={() => onAutoPlan(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 text-sky-300 hover:bg-slate-700 border border-slate-700 cursor-pointer transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            এখন থেকে রিশিডিউল
          </button>
          <button
            type="button"
            onClick={onSpeakPlan}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 cursor-pointer transition"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            প্ল্যান শোনাও
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="নতুন অফিস কাজের নাম লিখুন (যেমন: ক্লায়েন্ট প্রোপোজাল পাঠানো)..."
          className="md:col-span-5 px-3 py-2 text-sm rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="md:col-span-2 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
        >
          <option value="urgent">জরুরি (Urgent)</option>
          <option value="high">উচ্চ (High)</option>
          <option value="normal">সাধারণ (Normal)</option>
          <option value="low">কম (Low)</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="md:col-span-2 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
        >
          <option value="অফিস">অফিস</option>
          <option value="মিটিং">মিটিং</option>
          <option value="ইমেইল">ইমেইল</option>
          <option value="ব্যক্তিগত">ব্যক্তিগত</option>
        </select>
        <input
          type="number"
          min={10}
          max={360}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          title="আনুমানিক সময় (মিনিট)"
          className="md:col-span-1 px-2.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
        />
        <button
          type="submit"
          className="md:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-sky-500 text-slate-950 hover:bg-sky-400 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          যোগ করুন
        </button>

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="সংক্ষিপ্ত নোট (ঐচ্ছিক)..."
          className="md:col-span-7 px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 placeholder-slate-500"
        />
        <select
          value={dependsOn}
          onChange={(e) => setDependsOn(e.target.value)}
          className="md:col-span-5 px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
        >
          <option value="">কোন কাজের পর হবে? (নির্ভরতা নেই)</option>
          {pendingTasks.map((t) => (
            <option key={t.id} value={t.id}>
              এর পর: {t.title}
            </option>
          ))}
        </select>
      </form>

      {/* Active Scheduled Tasks */}
      <div className="space-y-2.5">
        {pendingTasks.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 text-center text-sm text-slate-400">
            কোনো পেন্ডিং কাজ নেই। উপরে নতুন কাজ যোগ করে "নিজে থেকে প্ল্যান বানাও" চাপুন।
          </div>
        ) : (
          pendingTasks.map((task, index) => {
            const badge = PRIORITY_BADGE[task.priority];
            return (
              <div
                key={task.id}
                className={`rounded-2xl p-4 border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  task.status === "in_progress"
                    ? "bg-emerald-500/10 border-emerald-500/40"
                    : "bg-slate-900/90 border-slate-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-xs font-mono px-2 py-1 rounded-lg bg-slate-800 text-slate-300">
                    #{index + 1}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{task.title}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {task.category}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-400">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {task.scheduled_start && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {task.scheduled_start} – {task.scheduled_end} ({task.estimated_minutes} মি.)
                        </span>
                      )}
                      {task.rationale_bn && (
                        <span className="text-slate-400">• {task.rationale_bn}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {task.status !== "in_progress" && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(task.id, "in_progress")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 cursor-pointer"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      শুরু
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onStatusChange(task.id, "done")}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    শেষ
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    title="মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Completed Tasks */}
      {doneTasks.length > 0 && (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-4 space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            সম্পন্ন কাজ ({doneTasks.length}টি)
          </h3>
          {doneTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-2 text-xs text-slate-400 py-1.5 border-b border-slate-800/60 last:border-0"
            >
              <button
                type="button"
                onClick={() => onStatusChange(task.id, "pending")}
                className="inline-flex items-center gap-2 hover:text-slate-200 cursor-pointer text-left"
              >
                <Circle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/30" />
                <span className="line-through">{task.title}</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteTask(task.id)}
                className="text-slate-600 hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
