'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/lib/stores/game-store';

const DEADZONE = 0.05;

/**
 * Polls the browser Gamepad API each animation frame and writes analog axes
 * to the game store. When active (any axis exceeds deadzone), Car3D uses
 * these values instead of keyboard keys for manual driving.
 *
 * Standard gamepad mapping:
 *   axes[0]       — left stick X:    -1 (left) … 1 (right)  → steering
 *   buttons[7]    — right trigger:    0 … 1                  → throttle
 *   buttons[6]    — left trigger:     0 … 1                  → brake
 *   buttons[9]    — Start             → pause / resume
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
        useGameStore.getState().setGamepadAxes(0, 0, 0, false);
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
        const rawSteer = gp.axes[0] ?? 0;
        const steer = Math.abs(rawSteer) > DEADZONE ? rawSteer : 0;

        // Standard mapping (Chrome/Edge, Xbox + PS): triggers are buttons[6/7].value (0–1).
        // Raw mapping (Firefox/Linux): triggers are axes[4/5] ranging -1 (released) to 1 (pressed).
        const isStandard = gp.mapping === 'standard';
        const throttle = isStandard
          ? (gp.buttons[7]?.value ?? 0)
          : Math.max(0, ((gp.axes[5] ?? -1) + 1) / 2);
        const brake = isStandard
          ? (gp.buttons[6]?.value ?? 0)
          : Math.max(0, ((gp.axes[4] ?? -1) + 1) / 2);

        const active = Math.abs(steer) > 0 || throttle > DEADZONE || brake > DEADZONE;

        useGameStore.getState().setGamepadAxes(steer, throttle, brake, active);

        // Start button → pause / resume (mirrors Escape key behaviour)
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
