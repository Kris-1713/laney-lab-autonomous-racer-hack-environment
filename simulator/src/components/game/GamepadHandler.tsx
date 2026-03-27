'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/lib/stores/game-store';

const DEADZONE = 0.05;

/**
 * Polls the browser Gamepad API each animation frame and writes directly to
 * the unified input store. When a gamepad is connected it owns all driving
 * input; KeyboardHandler defers to it.
 *
 * Standard gamepad mapping (Chrome/Edge, Xbox + PS):
 *   axes[0]    — left stick X: -1 (left) … 1 (right)  → steering (negated for car convention)
 *   buttons[7] — RT / R2:      0 … 1                   → throttle
 *   buttons[6] — LT / L2:      0 … 1                   → brake
 *   buttons[9] — Start / Options                        → pause / resume
 *
 * Raw mapping fallback (Firefox / Linux):
 *   axes[5]    — right trigger: -1 (released) … 1 (pressed) → throttle
 *   axes[4]    — left trigger:  -1 (released) … 1 (pressed) → brake
 */
export function GamepadHandler() {
  useEffect(() => {
    let rafId: number;

    function onConnected() {
      useGameStore.getState().setGamepadConnected(true);
    }

    function onDisconnected() {
      const remaining = navigator.getGamepads();
      const anyLeft = Array.from(remaining).some(Boolean);
      if (!anyLeft) {
        useGameStore.getState().setGamepadConnected(false);
        useGameStore.getState().setInput({ steer: 0, throttle: 0, brake: false });
      }
    }

    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);

    // In case a gamepad was already connected before this component mounted
    const already = Array.from(navigator.getGamepads()).some(Boolean);
    if (already) useGameStore.getState().setGamepadConnected(true);

    function poll() {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0] ?? gamepads[1] ?? gamepads[2] ?? gamepads[3];

      if (gp) {
        // Steer: negate axis so left stick left → steerTarget positive (left turn)
        const rawSteer = gp.axes[0] ?? 0;
        const steer = Math.abs(rawSteer) > DEADZONE ? -rawSteer : 0;

        // Triggers: standard mapping → buttons[6/7].value; raw mapping → axes[4/5]
        const isStandard = gp.mapping === 'standard';
        const throttle = isStandard
          ? (gp.buttons[7]?.value ?? 0)
          : Math.max(0, ((gp.axes[5] ?? -1) + 1) / 2);
        const brakeVal = isStandard
          ? (gp.buttons[6]?.value ?? 0)
          : Math.max(0, ((gp.axes[4] ?? -1) + 1) / 2);

        useGameStore.getState().setInput({ steer, throttle, brake: brakeVal > 0.1 });

        // Start / Options → pause / resume
        if (gp.buttons[9]?.pressed) {
          const store = useGameStore.getState();
          if (store.mode === 'driving') store.setMode('paused');
          else if (store.mode === 'paused') store.setMode('driving');
        }
      }

      rafId = requestAnimationFrame(poll);
    }

    rafId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('gamepadconnected', onConnected);
      window.removeEventListener('gamepaddisconnected', onDisconnected);
    };
  }, []);

  return null;
}
