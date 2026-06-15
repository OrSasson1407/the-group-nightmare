import type { IndividualConstraints } from "@group-nightmare/shared-types"
export interface DateNode { dateString: string; availableCount: number; saturationDegree: number }
export function getMRVParticipant(constraints: Record<string, IndividualConstraints>) {
  const ps = Object.values(constraints); if (!ps.length) return null
  return ps.reduce((b,c) => c.availabilityGrid.filter(d=>d.isAvailable).length < b.availabilityGrid.filter(d=>d.isAvailable).length ? c : b)
}
export function buildDateGraph(constraints: Record<string, IndividualConstraints>): DateNode[] {
  const ps = Object.values(constraints); if (!ps.length) return []
  const dates = new Set<string>(); ps.forEach(p=>p.availabilityGrid.forEach(d=>dates.add(d.dateString)))
  const nodes: DateNode[] = Array.from(dates).map(ds=>({ dateString:ds, availableCount: ps.filter(p=>p.availabilityGrid.some(d=>d.dateString===ds&&d.isAvailable)).length, saturationDegree:0 }))
  for(let i=0;i<nodes.length;i++){let s=0;for(let j=0;j<nodes.length;j++){if(i===j)continue;if(ps.some(p=>{const a=p.availabilityGrid.find(d=>d.dateString===nodes[i].dateString)?.isAvailable??false;const b=p.availabilityGrid.find(d=>d.dateString===nodes[j].dateString)?.isAvailable??false;return a!==b}))s++};nodes[i].saturationDegree=s}
  return nodes
}
export function getDSATUROrderedDates(nodes: DateNode[]): string[] { return [...nodes].sort((a,b)=>b.availableCount-a.availableCount||a.saturationDegree-b.saturationDegree||a.dateString.localeCompare(b.dateString)).map(n=>n.dateString) }
export function computeGroupBudget(budgets: number[]) { if(!budgets.length)return{proposedBudget:0,satisfiedCount:0,complianceScore:0}; const min=Math.min(...budgets); const sat=budgets.filter(b=>b>=min).length; return{proposedBudget:min,satisfiedCount:sat,complianceScore:sat/budgets.length} }
