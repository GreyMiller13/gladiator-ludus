// ============================================================
//  Долг отца: расписание платежей, автосписание, проигрыш
// ============================================================
const DEBT_WARN_DAYS = [3, 1];

function newDebt() {
  return { plan: DEBT_PLAN.slice(), idx: 0, paid: 0, holder: 'lender', cleared: false, cancelled: false };
}

const debtDay = i => DEBT_EVERY * (i + 1);
const debtActive = () => !!(STATE && STATE.debt && !STATE.debt.cleared && !STATE.debt.cancelled);

// Ближайший платёж: сумма, день срока и сколько дней до него
function debtNext() {
  if (!debtActive()) return null;
  const d = STATE.debt, day = debtDay(d.idx);
  return { amount: d.plan[d.idx], day, daysLeft: day - STATE.day };
}

function debtLeft() {
  if (!STATE || !STATE.debt) return 0;
  return STATE.debt.plan.slice(STATE.debt.idx).reduce((a, b) => a + b, 0);
}

const debtHolderName = () => (STATE.debt && STATE.debt.holder === 'rival' ? 'Гней Вар' : 'Лукрион');

// Наступил новый день (содержание уже списано): платёж, предупреждение или проигрыш
function debtOnNewDay() {
  const n = debtNext();
  if (!n) return null;
  const d = STATE.debt;
  if (n.daysLeft === 0) {
    if (STATE.gold < n.amount) {
      const short = n.amount - Math.max(0, STATE.gold);
      STATE.lost = { day: STATE.day, reason: 'debt', amount: n.amount, short, holder: d.holder };
      journal(`Срок платежа: ${debtHolderName()} ждёт ${n.amount} ден., а в казне не хватает ${short}. Лудус отобран за долги.`);
      return { type: 'default', amount: n.amount, short };
    }
    STATE.gold -= n.amount;
    d.paid += n.amount;
    d.idx++;
    if (d.idx >= d.plan.length) {
      d.cleared = true;
      journal(`Последний платёж: ${n.amount} ден. Долг отца уплачен до последнего денария!`);
      return { type: 'cleared', amount: n.amount };
    }
    const left = debtLeft();
    journal(`${debtHolderName()} получил ${n.amount} ден. в счёт долга. Осталось ${left}.`);
    return { type: 'paid', amount: n.amount, left };
  }
  if (DEBT_WARN_DAYS.includes(n.daysLeft)) {
    journal(`Через ${n.daysLeft} ${n.daysLeft === 1 ? 'день' : 'дня'} платёж по долгу: ${n.amount} ден.`);
    return { type: 'warn', amount: n.amount, daysLeft: n.daysLeft };
  }
  return null;
}

// Оставшиеся платежи растут в k раз (с округлением до 10 денариев)
function debtRaise(k) {
  const d = STATE.debt;
  for (let i = d.idx; i < d.plan.length; i++) d.plan[i] = Math.round(d.plan[i] * k / 10) * 10;
}

// Остаток долга списан; возвращает списанную сумму
function debtCancel() {
  const left = debtActive() ? debtLeft() : 0;
  if (STATE.debt) STATE.debt.cancelled = true;
  return left;
}

function debtUrgent() {
  const n = debtNext();
  // до срока ещё спишут содержание бойцов
  return !!n && n.daysLeft <= 2 && STATE.gold - upkeepCost() * n.daysLeft < n.amount;
}
