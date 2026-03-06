import { prisma } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { format, subDays } from "date-fns";

const getClient = () =>
  new OpenAI({
    baseURL: "https://models.github.ai/inference",
    apiKey: process.env.GITHUB_TOKEN,
  });

const MODEL = "openai/gpt-4o-mini";

function extractJson(text: string) {
  // Try code block first
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlock ? codeBlock[1].trim() : text.trim();

  // Find outermost { }
  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (raw[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (start === -1 || end === -1) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end));
}

export async function POST(request: Request) {
  try {
    const { message, conversationHistory = [] } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({
        intent: "general_chat",
        message: "Please configure your GITHUB_TOKEN in .env.local to use the AI input bar.",
      });
    }

    // Get profile and today's log
    const profile = await prisma.userProfile.findFirst();
    if (!profile) {
      return NextResponse.json({ intent: "error", message: "No profile found." }, { status: 404 });
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

    const [todayEntries, yesterdayEntries] = await Promise.all([
      prisma.foodEntry.findMany({ where: { userId: profile.id, date: today }, orderBy: { createdAt: "asc" } }),
      prisma.foodEntry.findMany({ where: { userId: profile.id, date: yesterday }, orderBy: { createdAt: "asc" } }),
    ]);

    // Build entry maps for both days
    const entryMap = new Map<string, string>();
    const entries = todayEntries; // for backwards compat with rest of the code

    function buildLog(dayEntries: typeof entries, prefix: string) {
      return dayEntries.map((e, i) => {
        const label = `${prefix}${i + 1}`;
        entryMap.set(label, e.id);
        entryMap.set(e.id, e.id);
        return `- ${label} [${e.mealType}] ${e.foodName} (${e.servingUnit}) | ${Math.round(e.calories)} cal, ${Math.round(e.proteinG)}g P, ${Math.round(e.carbsG)}g C, ${Math.round(e.fatG)}g F`;
      }).join("\n");
    }

    const todayLog = buildLog(todayEntries, "#");
    const yesterdayLog = buildLog(yesterdayEntries, "Y#");

    const totals = entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        proteinG: acc.proteinG + e.proteinG,
        carbsG: acc.carbsG + e.carbsG,
        fatG: acc.fatG + e.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    const todayLogWithTotals = [
      todayLog ? `TODAY (${today}):\n${todayLog}\n\nRunning totals: ${Math.round(totals.calories)} cal, ${Math.round(totals.proteinG)}g P, ${Math.round(totals.carbsG)}g C, ${Math.round(totals.fatG)}g F\nRemaining: ${Math.round(profile.calorieTarget - totals.calories)} cal, ${Math.round(profile.proteinTargetG - totals.proteinG)}g protein` : `TODAY (${today}): No food logged yet.`,
      yesterdayLog ? `\nYESTERDAY (${yesterday}):\n${yesterdayLog}` : "",
    ].join("\n");

    // Load food memories
    const memories = await prisma.foodMemory.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });
    const foodMemories = memories.length > 0
      ? memories.map((m) => `- "${m.foodName}": ${Math.round(m.calories)} cal, ${Math.round(m.proteinG)}g P, ${Math.round(m.carbsG)}g C, ${Math.round(m.fatG)}g F (${m.servingDesc})`).join("\n")
      : "";

    // --- Fetch DEXA data ---
    const dexaScans = await prisma.dexaScan.findMany({ orderBy: { scanDate: "desc" }, take: 5 });
    let dexaContext = "";
    if (dexaScans.length > 0) {
      const latest = dexaScans[0];
      dexaContext = `Latest scan (${latest.scanDate}): ${latest.bodyFatPct}% body fat, ${Math.round(latest.leanMassLbs)} lbs lean, ${Math.round(latest.fatMassLbs)} lbs fat`;
      if (latest.boneMassLbs) dexaContext += `, ${Math.round(latest.boneMassLbs)} lbs bone`;
      if (latest.visceralFat) dexaContext += `, VAT: ${latest.visceralFat}`;
      if (latest.trunkFatPct) dexaContext += `\nRegional fat: Trunk ${latest.trunkFatPct}%, Arms ${latest.armsFatPct || "?"}%, Legs ${latest.legsFatPct || "?"}%`;
      if (latest.trunkLeanLbs) dexaContext += `\nRegional lean: Trunk ${Math.round(latest.trunkLeanLbs)} lbs, Arms ${Math.round(latest.armsLeanLbs || 0)} lbs, Legs ${Math.round(latest.legsLeanLbs || 0)} lbs`;
      if (latest.androidFatPct) dexaContext += `\nAndroid ${latest.androidFatPct}%, Gynoid ${latest.gynoidFatPct || "?"}%, A/G ratio ${latest.agRatio || "?"}`;

      if (dexaScans.length >= 2) {
        const prev = dexaScans[1];
        const bfChange = Math.round((latest.bodyFatPct - prev.bodyFatPct) * 10) / 10;
        const leanChange = Math.round((latest.leanMassLbs - prev.leanMassLbs) * 10) / 10;
        const fatChange = Math.round((latest.fatMassLbs - prev.fatMassLbs) * 10) / 10;
        dexaContext += `\n\nChange since previous scan (${prev.scanDate}): Body fat ${bfChange > 0 ? "+" : ""}${bfChange}%, Lean mass ${leanChange > 0 ? "+" : ""}${leanChange} lbs, Fat mass ${fatChange > 0 ? "+" : ""}${fatChange} lbs`;
      }
    }

    // --- Fetch activity data (last 30 days) ---
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const recentMetrics = await prisma.healthMetric.findMany({
      where: { date: { gte: thirtyDaysAgo } },
    });
    const recentWorkouts = await prisma.workout.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
      take: 10,
    });

    let activityContext = "";
    if (recentMetrics.length > 0) {
      const byType: Record<string, number[]> = {};
      for (const m of recentMetrics) {
        if (!byType[m.type]) byType[m.type] = [];
        byType[m.type].push(m.value);
      }
      const avg = (arr: number[]) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

      const lines: string[] = ["30-day averages:"];
      if (byType.steps) lines.push(`- Steps: ${avg(byType.steps).toLocaleString()}/day`);
      if (byType.activeCalories) lines.push(`- Active calories: ${avg(byType.activeCalories)}/day`);
      if (byType.exerciseMinutes) lines.push(`- Exercise: ${avg(byType.exerciseMinutes)} min/day`);
      if (byType.restingHR) lines.push(`- Resting HR: ${avg(byType.restingHR)} bpm`);
      if (byType.hrv) lines.push(`- HRV: ${avg(byType.hrv)} ms`);
      if (byType.sleep || byType.sleepMinutes) {
        const sleepArr = byType.sleep || byType.sleepMinutes;
        lines.push(`- Sleep: ${(avg(sleepArr) / 60).toFixed(1)} hrs/night`);
      }

      if (recentWorkouts.length > 0) {
        lines.push(`\nRecent workouts (last 10):`);
        for (const w of recentWorkouts) {
          lines.push(`- ${w.date}: ${w.workoutType} (${Math.round(w.durationMin)} min${w.caloriesBurned ? `, ${Math.round(w.caloriesBurned)} cal` : ""})`);
        }
      }

      activityContext = lines.join("\n");
    }

    // --- Fetch nutrition adherence (last 14 days) ---
    const fourteenDaysAgo = format(subDays(new Date(), 14), "yyyy-MM-dd");
    const recentDates: string[] = [];
    for (let i = 13; i >= 0; i--) {
      recentDates.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
    }
    const recentEntries = await prisma.foodEntry.findMany({
      where: { userId: profile.id, date: { gte: fourteenDaysAgo } },
    });

    let adherenceContext = "";
    if (recentEntries.length > 0) {
      const dailyTotals = recentDates.map((date) => {
        const dayEntries = recentEntries.filter((e) => e.date === date);
        if (dayEntries.length === 0) return null;
        return {
          date,
          cal: Math.round(dayEntries.reduce((s, e) => s + e.calories, 0)),
          protein: Math.round(dayEntries.reduce((s, e) => s + e.proteinG, 0)),
        };
      }).filter(Boolean) as { date: string; cal: number; protein: number }[];

      if (dailyTotals.length > 0) {
        const avgCal = Math.round(dailyTotals.reduce((s, d) => s + d.cal, 0) / dailyTotals.length);
        const avgProtein = Math.round(dailyTotals.reduce((s, d) => s + d.protein, 0) / dailyTotals.length);
        const onTargetCal = dailyTotals.filter((d) => Math.abs(d.cal - profile.calorieTarget) / profile.calorieTarget <= 0.1).length;
        const onTargetProtein = dailyTotals.filter((d) => d.protein >= profile.proteinTargetG * 0.9).length;

        adherenceContext = `Last ${dailyTotals.length} days tracked:
- Avg calories: ${avgCal}/day (target: ${profile.calorieTarget})
- Avg protein: ${avgProtein}g/day (target: ${profile.proteinTargetG}g)
- Days within 10% of calorie target: ${onTargetCal}/${dailyTotals.length}
- Days hitting 90%+ protein target: ${onTargetProtein}/${dailyTotals.length}
- Calorie delta: ${avgCal > profile.calorieTarget ? `+${avgCal - profile.calorieTarget} surplus` : `${profile.calorieTarget - avgCal} deficit`} on average`;
      }
    }

    const systemPrompt = buildSystemPrompt(todayLogWithTotals, {
      calories: profile.calorieTarget,
      proteinG: profile.proteinTargetG,
      carbsG: profile.carbTargetG,
      fatG: profile.fatTargetG,
      fiberG: profile.fiberTargetG,
    }, {
      name: profile.name,
      currentWeightKg: profile.currentWeightKg,
      goalType: profile.goalType,
    }, foodMemories, {
      dexa: dexaContext,
      activity: activityContext,
      nutritionAdherence: adherenceContext,
    });

    // Build message history
    const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of conversationHistory.slice(-8)) {
      msgs.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }

    msgs.push({ role: "user", content: message });

    // Single GPT call — it returns actions + reply
    const client = getClient();
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: msgs,
    });

    let text = response.choices[0]?.message?.content || "";
    console.log("GPT raw response:", text.slice(0, 500));

    let parsed;
    try {
      parsed = extractJson(text);
    } catch {
      // GPT returned plain text — check if the user was asking for a change
      // If so, retry with a stronger nudge to return JSON
      const looksLikeAction = /\b(fix|change|update|correct|make|set|remove|delete|add|log)\b/i.test(message);
      if (looksLikeAction) {
        try {
          const retry = await client.chat.completions.create({
            model: MODEL,
            max_tokens: 1500,
            messages: [
              ...msgs,
              { role: "assistant", content: text },
              { role: "user", content: "You must respond with JSON in the format {\"actions\": [...], \"reply\": \"...\"}. Do not respond with plain text. Actually perform the action — include the edit_food/delete_food/log_food action in the actions array with the correct entry ID." },
            ],
          });
          text = retry.choices[0]?.message?.content || "";
          console.log("GPT retry response:", text.slice(0, 500));
          parsed = extractJson(text);
        } catch {
          return NextResponse.json({ intent: "general_chat", message: text });
        }
      } else {
        return NextResponse.json({ intent: "general_chat", message: text });
      }
    }

    // Handle cases where GPT returns a bare action instead of {actions: [], reply: ""}
    let actions;
    let reply;
    if (parsed.actions) {
      actions = parsed.actions;
      reply = parsed.reply || "Done!";
    } else if (parsed.type) {
      // GPT returned a bare action object like {"type": "edit_food", ...}
      actions = [parsed];
      reply = parsed.reply || "Done!";
    } else {
      actions = [];
      reply = parsed.reply || parsed.message || JSON.stringify(parsed);
    }

    // Normalize meal types — GPT sometimes returns "snacks" instead of "snack", etc.
    const VALID_MEALS = ["breakfast", "lunch", "dinner", "snack"];
    function normalizeMealType(mt: string): string {
      const lower = (mt || "snack").toLowerCase().trim();
      if (VALID_MEALS.includes(lower)) return lower;
      if (lower === "snacks") return "snack";
      if (lower === "brunch") return "breakfast";
      return "snack";
    }

    console.log("Parsed actions:", JSON.stringify(actions));
    let hasDataChange = false;

    // Process actions
    for (const action of actions) {
      switch (action.type) {
        case "log_food": {
          const logDate = action.date === "yesterday" ? yesterday : (action.date || today);
          await prisma.foodEntry.create({
            data: {
              userId: profile.id,
              date: logDate,
              mealType: normalizeMealType(action.mealType),
              foodName: action.foodName || "Unknown food",
              servingSize: 1,
              servingUnit: action.servingDescription || "serving",
              calories: Number(action.calories) || 0,
              proteinG: Number(action.proteinG) || 0,
              carbsG: Number(action.carbsG) || 0,
              fatG: Number(action.fatG) || 0,
              fiberG: Number(action.fiberG) || 0,
              loggedVia: "ai",
            },
          });
          hasDataChange = true;
          break;
        }

        case "edit_food": {
          if (!action.entryId) break;
          // Resolve entry ID: could be "#1", "1", a real cuid, or a food name
          const editId = entryMap.get(action.entryId) || entryMap.get(`#${action.entryId}`);
          let entry = editId ? (entries.find((e) => e.id === editId) || null) : null;
          if (!entry) {
            entry = await prisma.foodEntry.findUnique({ where: { id: action.entryId } });
          }
          if (!entry) {
            entry = entries.find(
              (e) => e.foodName.toLowerCase().includes(action.entryId.toLowerCase())
            ) || null;
          }
          if (entry && action.updates) {
            const updateData: Record<string, number | string> = {};
            const safeNum = (v: unknown) => v != null && !isNaN(Number(v)) ? Number(v) : null;
            const cal = safeNum(action.updates.calories);
            const pro = safeNum(action.updates.proteinG);
            const carb = safeNum(action.updates.carbsG);
            const fat = safeNum(action.updates.fatG);
            const fib = safeNum(action.updates.fiberG);
            if (cal != null) updateData.calories = cal;
            if (pro != null) updateData.proteinG = pro;
            if (carb != null) updateData.carbsG = carb;
            if (fat != null) updateData.fatG = fat;
            if (fib != null) updateData.fiberG = fib;
            if (action.updates.foodName != null) updateData.foodName = action.updates.foodName;
            if (action.updates.mealType != null) updateData.mealType = normalizeMealType(action.updates.mealType);
            if (action.updates.servingSize != null && !isNaN(Number(action.updates.servingSize))) updateData.servingSize = Number(action.updates.servingSize);
            if (action.updates.servingDescription != null) updateData.servingUnit = action.updates.servingDescription;
            if (Object.keys(updateData).length > 0) {
              await prisma.foodEntry.update({ where: { id: entry.id }, data: updateData });
              hasDataChange = true;
              console.log("Edited entry:", entry.id, updateData);
            }
          } else {
            console.log("Edit failed — entry not found for ID:", action.entryId);
          }
          break;
        }

        case "delete_food": {
          if (!action.entryId) break;
          const delId = entryMap.get(action.entryId) || entryMap.get(`#${action.entryId}`);
          let entry = delId ? (entries.find((e) => e.id === delId) || null) : null;
          if (!entry) {
            entry = await prisma.foodEntry.findUnique({ where: { id: action.entryId } });
          }
          if (!entry) {
            entry = entries.find(
              (e) => e.foodName.toLowerCase().includes(action.entryId.toLowerCase())
            ) || null;
          }
          if (entry) {
            await prisma.foodEntry.delete({ where: { id: entry.id } });
            hasDataChange = true;
          }
          break;
        }

        case "delete_all": {
          await prisma.foodEntry.deleteMany({ where: { userId: profile.id, date: today } });
          hasDataChange = true;
          break;
        }

        case "save_memory": {
          if (action.foodName) {
            await prisma.foodMemory.upsert({
              where: { foodName: action.foodName.toLowerCase() },
              create: {
                foodName: action.foodName.toLowerCase(),
                calories: action.calories || 0,
                proteinG: action.proteinG || 0,
                carbsG: action.carbsG || 0,
                fatG: action.fatG || 0,
                fiberG: action.fiberG || 0,
                servingDesc: action.servingDesc || "1 serving",
              },
              update: {
                calories: action.calories || 0,
                proteinG: action.proteinG || 0,
                carbsG: action.carbsG || 0,
                fatG: action.fatG || 0,
                fiberG: action.fiberG || 0,
                servingDesc: action.servingDesc || "1 serving",
              },
            });
          }
          break;
        }

        case "change_goal": {
          const goalData: Record<string, number | string> = {};
          if (action.calorieTarget) goalData.calorieTarget = action.calorieTarget;
          if (action.proteinTargetG) goalData.proteinTargetG = action.proteinTargetG;
          if (action.carbTargetG) goalData.carbTargetG = action.carbTargetG;
          if (action.fatTargetG) goalData.fatTargetG = action.fatTargetG;
          if (action.fiberTargetG) goalData.fiberTargetG = action.fiberTargetG;
          if (action.goalType) goalData.goalType = action.goalType;
          if (Object.keys(goalData).length > 0) {
            await prisma.userProfile.update({ where: { id: profile.id }, data: goalData });
            hasDataChange = true;
          }
          break;
        }

        case "update_profile": {
          const profileData: Record<string, string | number> = {};
          if (action.name) profileData.name = action.name;
          if (action.currentWeightLbs) profileData.currentWeightKg = action.currentWeightLbs * 0.453592;
          if (action.age) profileData.age = action.age;
          if (Object.keys(profileData).length > 0) {
            await prisma.userProfile.update({ where: { id: profile.id }, data: profileData });
            hasDataChange = true;
          }
          break;
        }
      }
    }

    // If data changed, recalculate actual totals and append to reply
    let finalReply = reply;
    if (hasDataChange) {
      const updatedEntries = await prisma.foodEntry.findMany({
        where: { userId: profile.id, date: today },
      });
      const newTotals = updatedEntries.reduce(
        (acc, e) => ({
          cal: acc.cal + e.calories,
          p: acc.p + e.proteinG,
          c: acc.c + e.carbsG,
          f: acc.f + e.fatG,
        }),
        { cal: 0, p: 0, c: 0, f: 0 }
      );
      const remCal = profile.calorieTarget - Math.round(newTotals.cal);
      const remP = profile.proteinTargetG - Math.round(newTotals.p);
      finalReply += `\n\nUpdated totals: ${Math.round(newTotals.cal)} cal, ${Math.round(newTotals.p)}g P, ${Math.round(newTotals.c)}g C, ${Math.round(newTotals.f)}g F | Remaining: ${remCal} cal, ${remP}g protein`;
    }

    return NextResponse.json({
      intent: actions.length > 0 ? actions[0].type : "general_chat",
      message: finalReply,
      action: hasDataChange ? { type: "data_changed" } : undefined,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { intent: "error", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
