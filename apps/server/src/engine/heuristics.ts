import type { IndividualConstraints } from '@tgn/shared';

export interface DateNode {
  dateString: string;
  availableCount: number;
  saturationDegree: number;
}

export function getMRVParticipant(constraints: Record<string, IndividualConstraints>) {
  const ps = Object.values(constraints);
  if (!ps.length) return null;
  return ps.reduce((b, c) =>
    c.availabilityGrid.filter(d => d.isAvailable).length <
    b.availabilityGrid.filter(d => d.isAvailable).length
      ? c
      : b
  );
}

export function buildDateGraph(constraints: Record<string, IndividualConstraints>): DateNode[] {
  const ps = Object.values(constraints);
  if (!ps.length) return [];

  const dates = new Set<string>();
  ps.forEach(p => p.availabilityGrid.forEach(d => dates.add(d.dateString)));

  const nodes: DateNode[] = Array.from(dates).map(ds => ({
    dateString: ds,
    availableCount: ps.filter(p =>
      p.availabilityGrid.some(d => d.dateString === ds && d.isAvailable)
    ).length,
    saturationDegree: 0
  }));

  // Compute saturation degree
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    let s = 0;
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const other = nodes[j]!;
      // Check if there exists a participant whose availability differs between the two dates
      if (
        ps.some(p => {
          const a = p.availabilityGrid.find(d => d.dateString === node.dateString)?.isAvailable ?? false;
          const b = p.availabilityGrid.find(d => d.dateString === other.dateString)?.isAvailable ?? false;
          return a !== b;
        })
      ) {
        s++;
      }
    }
    node.saturationDegree = s;
  }

  return nodes;
}

export function getDSATUROrderedDates(nodes: DateNode[]): string[] {
  return [...nodes]
    .sort((a, b) =>
      b.availableCount - a.availableCount ||
      a.saturationDegree - b.saturationDegree ||
      a.dateString.localeCompare(b.dateString)
    )
    .map(n => n.dateString);
}

export function computeGroupBudget(budgets: number[]) {
  if (!budgets.length) {
    return { proposedBudget: 0, satisfiedCount: 0, complianceScore: 0 };
  }
  const min = Math.min(...budgets);
  const sat = budgets.filter(b => b >= min).length;
  return {
    proposedBudget: min,
    satisfiedCount: sat,
    complianceScore: sat / budgets.length
  };
}