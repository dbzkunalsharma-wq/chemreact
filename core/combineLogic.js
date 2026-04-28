// combineLogic.js — proximity-bonding "wow factor" for ChemReact.
//
// Listens to tracker events on the bus and decides when two (and later,
// more) detected element cards are physically close enough to combine
// into a compound. Pure logic + bus emissions: no DOM, no audio, no
// celebration. UI consequences belong in screens / bridges that listen
// to COMBINE / REACTION_DONE / DISCOVERY / REACTION_BROKEN.
//
// Usage from main.js:
//   import { setupCombineLogic } from './core/combineLogic.js';
//   const combineBridge = setupCombineLogic({
//     bus, EVENTS, state, reactions, compounds, tracker: trackerMock
//   });
//   // teardown: combineBridge.teardown();
//
// Test plan (run in dev console once integrated):
//   cr.tracker.simulate('+H'); cr.tracker.simulate('+O');
//   cr.tracker.setDistance('H', 'O', 10);  // → COMBINE water_synthesis
//   cr.tracker.setDistance('H', 'O', 30);  // → REACTION_BROKEN, pair re-armed
//   cr.tracker.setDistance('H', 'O', 10);  // → COMBINE water_synthesis again

// ── Tunables ──────────────────────────────────────────────────────────
const PROXIMITY_THRESHOLD_CM = 15;  // distance below which a pair fires
const BREAK_HYSTERESIS_CM    = 5;   // pair must move past 15+5=20cm to re-arm
const DEBOUNCE_MS            = 1500;// min gap between same-pair re-fires
const REACTION_DURATION_MS   = 700; // delay between COMBINE and REACTION_DONE
// ─────────────────────────────────────────────────────────────────────

/**
 * Canonical pair key — order-independent, so "Cu|O" === "O|Cu".
 */
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Given a candidate set of element ids and the reactions table,
 * find the first cardTriggerable reaction whose reactant key-set
 * matches exactly. Stoichiometric counts are intentionally ignored
 * for the trigger decision (counts only matter for balanced display).
 */
function findReactionForElements(elementIds, reactions) {
  const want = new Set(elementIds);
  for (const r of reactions) {
    if (!r || r.cardTriggerable !== true) continue;
    const reactantKeys = Object.keys(r.reactants || {});
    if (reactantKeys.length !== want.size) continue;
    let match = true;
    for (const k of reactantKeys) {
      if (!want.has(k)) { match = false; break; }
    }
    if (match) return r;
  }
  return null;
}

export function setupCombineLogic({
  bus, EVENTS, state, reactions, compounds, tracker
} = {}) {
  if (!bus || !EVENTS || !Array.isArray(reactions)) {
    console.warn('[combineLogic] missing bus/EVENTS/reactions — bridge inactive.');
    return { teardown() {} };
  }

  // Currently-detected element ids (populated from ELEMENT_DETECTED / _LOST).
  const active = new Set();

  // Latest distance per pair: Map<"A|B", cm>.
  const distances = new Map();

  // Pairs currently considered "fired" — they triggered a COMBINE and have
  // not yet broken apart (distance hasn't crossed the hysteresis ceiling).
  // Until a pair breaks, it cannot re-fire.
  const firedPairs = new Set();

  // Last-fire timestamp per pair, for the DEBOUNCE_MS guard.
  const lastFireAt = new Map();

  // Pending REACTION_DONE timers, keyed by pair so we can cancel on teardown.
  const pendingDoneTimers = new Map();

  // Bus unsubscribers, collected for teardown.
  const offs = [];

  // ── Helpers ─────────────────────────────────────────────────────────

  function tryFireForPair(a, b, cm) {
    const key = pairKey(a, b);

    // Already fired and not yet broken? Wait for the cards to part.
    if (firedPairs.has(key)) return;

    // Debounce: same pair can't fire again within DEBOUNCE_MS even if
    // the firedPairs flag was cleared (e.g. a fast swap-by quickly).
    const last = lastFireAt.get(key) || 0;
    if (Date.now() - last < DEBOUNCE_MS) return;

    // Both elements still on table? (sanity — bus ordering can race)
    if (!active.has(a) || !active.has(b)) return;

    const reaction = findReactionForElements([a, b], reactions);
    if (!reaction) return;

    // Mark fired BEFORE emitting so listeners can't re-entrantly trigger us.
    firedPairs.add(key);
    lastFireAt.set(key, Date.now());

    bus.emit(EVENTS.COMBINE, {
      reactionId: reaction.id,
      reactants:  { a, b },
      product:    reaction.product,
      balanced:   reaction.balanced,
      effect:     reaction.effect
    });

    // First-time discovery? state.unlockCompound() returns true if it's
    // a brand-new entry; it also internally calls recordDiscovery which
    // emits EVENTS.DISCOVERY({ type:'compound', id }). We do NOT re-emit
    // here — that would double-fire celebration / audio bridges.
    if (state && typeof state.unlockCompound === 'function' && reaction.product) {
      const wasNew = state.unlockCompound(reaction.product);
      if (wasNew) {
        // state.recordDiscovery already emitted DISCOVERY; nothing to do.
        // (Spec allows for a richer payload — kept minimal to avoid double-fire.)
      }
    } else if (reaction.product) {
      // No state available — emit a bare DISCOVERY so listeners still react.
      bus.emit(EVENTS.DISCOVERY, {
        type: 'compound',
        id: reaction.product,
        product: reaction.product,
        reactionId: reaction.id
      });
    }

    // REACTION_DONE fires after the bond animation duration so screens can
    // sequence the celebration cleanly.
    const doneTimer = setTimeout(() => {
      pendingDoneTimers.delete(key);
      bus.emit(EVENTS.REACTION_DONE, {
        reactionId: reaction.id,
        product:    reaction.product
      });
    }, REACTION_DURATION_MS);
    pendingDoneTimers.set(key, doneTimer);
  }

  function maybeBreakPair(a, b, cm) {
    const key = pairKey(a, b);
    if (!firedPairs.has(key)) return;
    if (cm < PROXIMITY_THRESHOLD_CM + BREAK_HYSTERESIS_CM) return;

    // Cards moved apart — clear the fired flag so a future close-together
    // event can fire it again.
    firedPairs.delete(key);

    bus.emit(EVENTS.REACTION_BROKEN, {
      reactants: { a, b },
      cm
    });
  }

  function dropPairsInvolving(elementId) {
    // When an element disappears, drop its distance entries and clear
    // any "fired" flags so that re-detection starts clean.
    for (const key of [...distances.keys()]) {
      const [x, y] = key.split('|');
      if (x === elementId || y === elementId) {
        distances.delete(key);
        if (firedPairs.delete(key)) {
          // Treat element-loss as an implicit break.
          bus.emit(EVENTS.REACTION_BROKEN, {
            reactants: { a: x, b: y },
            cm: Infinity
          });
        }
        const t = pendingDoneTimers.get(key);
        if (t) { clearTimeout(t); pendingDoneTimers.delete(key); }
      }
    }
  }

  // ── Subscriptions ───────────────────────────────────────────────────

  offs.push(bus.on(EVENTS.ELEMENT_DETECTED, (p) => {
    const id = p && p.elementId;
    if (!id) return;
    active.add(id);
  }));

  offs.push(bus.on(EVENTS.ELEMENT_LOST, (p) => {
    const id = p && p.elementId;
    if (!id) return;
    active.delete(id);
    dropPairsInvolving(id);
  }));

  offs.push(bus.on(EVENTS.DISTANCE_CHANGE, (p) => {
    if (!p) return;
    const { a, b, cm } = p;
    if (!a || !b || typeof cm !== 'number' || a === b) return;

    const key = pairKey(a, b);
    distances.set(key, cm);

    if (cm <= PROXIMITY_THRESHOLD_CM) {
      tryFireForPair(a, b, cm);
    } else {
      maybeBreakPair(a, b, cm);
    }
  }));

  // ── Public surface ──────────────────────────────────────────────────

  return {
    /** Snapshot of currently-detected element ids. */
    getActive() { return [...active]; },
    /** Snapshot of latest known pair distances (cm). */
    getDistances() { return Object.fromEntries(distances); },
    /** Pairs currently in the "fired, awaiting break" state. */
    getFiredPairs() { return [...firedPairs]; },

    teardown() {
      offs.forEach((off) => { try { off(); } catch {} });
      offs.length = 0;
      pendingDoneTimers.forEach((t) => clearTimeout(t));
      pendingDoneTimers.clear();
      active.clear();
      distances.clear();
      firedPairs.clear();
      lastFireAt.clear();
    }
  };
}

export default setupCombineLogic;
