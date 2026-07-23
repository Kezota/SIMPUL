import { loadActivities, computeNodeStats, computeInsights } from './src/lib/analysis.ts'
import { themeMeta } from './src/lib/enrich.ts'
const { activities, dropped } = loadActivities()
console.log('n=', activities.length, 'dropped=', dropped)
for (const a of activities) console.log(String(a.distanceM).padStart(6), a.accessClass.padEnd(7), a.theme.padEnd(14), a.sentiment.padEnd(10), a.nearestNodeName.padEnd(26), a.title.slice(0,40))
const ns = computeNodeStats(activities)
console.log('\n--- nodes ---')
for (const n of ns) console.log(String(n.pulseIndex).padStart(3), String(n.count).padStart(2), n.node.name)
const ins = computeInsights(activities, ns)
console.log('\ncoverage', ins.coverageRatio.toFixed(2), 'median', ins.medianDistanceM, 'complaint', ins.complaintRatio.toFixed(2), 'blank', ins.blankSpots.length)
console.log('themes', ins.themeCounts.map(t=>`${t.theme}:${t.count}`).join(' '))
