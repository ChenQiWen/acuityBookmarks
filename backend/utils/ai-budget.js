// Minimal daily call budget guardrail for AI endpoints

const DAILY_MAX_CALLS = parseInt(process.env.AI_DAILY_MAX_CALLS || '2000', 10);

let state = {
  dayStamp: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  calls: 0
};

function ensureDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.dayStamp !== today) {
    state = { dayStamp: today, calls: 0 };
  }
}

export function canProceedCall() {
  ensureDay();
  return state.calls < DAILY_MAX_CALLS;
}

export function recordCall() {
  ensureDay();
  state.calls += 1;
}

export function getBudgetStatus() {
  ensureDay();
  return { day: state.dayStamp, calls: state.calls, dailyMax: DAILY_MAX_CALLS };
}
