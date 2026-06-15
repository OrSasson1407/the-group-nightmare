import { parentPort, workerData } from 'worker_threads';
import type { PlanningRoomSession, SolverCandidate } from '@tgn/shared';
import { getMRVParticipant, buildDateGraph, getDSATUROrderedDates, computeGroupBudget } from './heuristics.js';

const roomData = workerData as PlanningRoomSession;
const startTime = Date.now();

try {
  const constraints = roomData.constraintsMatrix;
  const participantsCount = roomData.participants.length;

  // MRV: start from the most constrained participant to guide date prioritization
  const mrvParticipant = getMRVParticipant(constraints);
  const mrvDates = new Set(
    mrvParticipant?.availabilityGrid.filter(d => d.isAvailable).map(d => d.dateString) ?? []
  );

  const dateNodes = buildDateGraph(constraints);
  const orderedDates = getDSATUROrderedDates(dateNodes);

  // Prioritize dates the MRV bottleneck participant can actually attend
  const prioritizedDates = [
    ...orderedDates.filter(d => mrvDates.has(d)),
    ...orderedDates.filter(d => !mrvDates.has(d))
  ];

  const topCandidates: SolverCandidate[] = [];

  for (const dateStr of prioritizedDates) {
    let availableCount = 0;
    const budgets: number[] = [];

    for (const p of Object.values(constraints)) {
      const day = p.availabilityGrid.find(d => d.dateString === dateStr);
      if (day?.isAvailable) {
        availableCount++;
        budgets.push(Number(p.encryptedMaxBudget) || 0);
      }
    }

    if (availableCount > 0) {
      const budgetStats = computeGroupBudget(budgets);
      const candidate: SolverCandidate = {
        targetDate: dateStr,
        proposedBudget: budgetStats.proposedBudget,
        satisfiedCount: availableCount,
        totalParticipants: participantsCount,
        complianceScore: (availableCount / participantsCount) * 100
      };
      topCandidates.push(candidate);

      // Stream partial results every 10 candidates so FallbackStorage stays fresh on timeout
      if (topCandidates.length % 10 === 0) {
        const partial = [...topCandidates]
          .sort((a, b) => b.complianceScore - a.complianceScore || a.proposedBudget - b.proposedBudget)
          .slice(0, 3);
        parentPort?.postMessage({ type: 'partial', candidates: partial });
      }
    }
  }

  topCandidates.sort((a, b) => b.complianceScore - a.complianceScore || a.proposedBudget - b.proposedBudget);

  parentPort?.postMessage({
    type: 'done',
    isOptimal: topCandidates[0]?.complianceScore === 100,
    topCandidates: topCandidates.slice(0, 3),
    solverDurationMs: Date.now() - startTime
  });
} catch (err) {
  parentPort?.postMessage({ type: 'done', isOptimal: false, topCandidates: [], solverDurationMs: Date.now() - startTime });
}
