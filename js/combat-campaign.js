// Итоги нового экрана. Battle хранит копии бойцов до завершения церемонии.
// Кампания получает результаты один раз, через прежние ключи и формат сохранения.
const combatWound = u => u.alive ? 1 : u.kills ? 2 : 3;
const combatLootChance = spared => spared ? 7 : 18;
const combatCanDefend = u => u.apLeft === u.ap;

function combatCommit(s) {
  if (s.committed) return;
  const b = s.b, ev = s.event, won = b.winner === 'player', contract = ev.kind === 'contract';
  if (!b.over || (s.court || []).some(u => !s.verdicts[u.uid]?.result)) return;
  s.committed = true;
  ev.done = true;
  for (const row of s.rewardRows) {
    const u = row.u, g = STATE.gladiators.find(g => g.id === u.g.id);
    if (!g) continue;
    g.foughtToday = true;
    g.record.fights++;
    g.record.kills += contract ? 0 : u.kills;
    if (won) g.record.wins++; else g.record.losses++;
    row.ups = addXp(g, row.xp);
    for (const level of row.ups) track('levelUp', { g, level });
    g.fame += row.fame;
    const v = s.verdicts[u.uid];
    if (!u.alive && (won || contract)) g.wounded = Math.max(g.wounded, 1);
    if (v) {
      track('verdict', { g, result: v.result, chance: v.chance });
      if (v.result === 'live') {
        g.wounded = Math.max(g.wounded, v.wound);
        g.record.spared++;
      } else {
        STATE.gladiators = STATE.gladiators.filter(x => x.id !== g.id);
        STATE.graveyard.push({
          name: g.name, cls: g.cls, level: g.level, origin: g.origin, record: { ...g.record },
          look: g.look, attrs: { ...g.attrs }, equip: JSON.parse(JSON.stringify(g.equip)),
          day: STATE.day, place: b.tier.place, killer: u.killedBy ? u.killedBy.g.name : null, kills: u.kills,
        });
      }
    }
    u.g = g;
  }
  const info = battleInfo({ b, event: ev, survived: s.survived });
  if (contract) {
    const result = META.contractResult(ev, info);
    s.contractSuccess = result.success;
    s.reward = result.gold;
    s.fame = result.fame || 0;
    s.artifact = result.artifact;
  } else {
    STATE.gold += s.reward;
    STATE.fame = Math.max(0, STATE.fame + s.fame);
    if (s.reward) track('gold', { amount: s.reward });
    for (const loot of s.loot) STATE.armory.push(loot.it);
    for (const u of s.court || []) {
      if (u.side === 'enemy' && s.verdicts[u.uid].result === 'die') track('enemyExecuted', { g: u.g });
    }
    if (won && ev.kind === 'final') { STATE.finalWon = true; STATE.finalDay = STATE.day; }
    journal(`${won ? 'Победа' : 'Поражение'}: ${b.tier.place}. ${s.reward} денариев, ${s.fame} славы.`);
  }
  track('battleEnd', info);
  storyBattle(info);
  save();
}
