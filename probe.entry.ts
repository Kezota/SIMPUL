import { loadActivities, computeNodeStats, computeInsights } from './src/lib/analysis'
const { activities, dropped } = loadActivities()
const lines: string[] = []
lines.push(`n=${activities.length} dropped=${dropped}`)
for (const a of activities)
  lines.push(
    `${String(a.distanceM).padStart(6)}  ${a.accessClass.padEnd(7)} ${a.theme.padEnd(14)} ${a.sentiment.padEnd(10)} ${a.nearestNodeName.padEnd(26)} ${a.title.slice(0, 42)}`,
  )
const ns = computeNodeStats(activities)
lines.push('--- nodes ---')
for (const n of ns) lines.push(`${String(n.pulseIndex).padStart(3)} ${String(n.count).padStart(2)}  ${n.node.name}  dom=${n.dominantTheme}`)
const ins = computeInsights(activities, ns)
lines.push(`coverage=${ins.coverageRatio.toFixed(2)} median=${ins.medianDistanceM} complaint=${ins.complaintRatio.toFixed(2)} blank=${ins.blankSpots.length}`)
lines.push('themes ' + ins.themeCounts.map((t) => `${t.theme}:${t.count}`).join(' '))
console.log(lines.join('\n'))
