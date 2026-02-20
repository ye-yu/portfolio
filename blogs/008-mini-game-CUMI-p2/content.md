# Building a Daily Color Mixing Game: A Technical Deep Dive

## Introduction

Welcome to part 2 of a case study of **CUMI (Can You Mix It?)**, a web-based color mixing game where players attempt to match target colors by mixing from a limited palette. Check out the game at:

[CUMI](/cumi)


In this post, I'll walk through the technical decisions and implementations that brought this game to life—from color science fundamentals to modern web APIs.

In this part 2 discussion - The gameplay challenge: **How do you build a game that generates daily unique puzzles and persists game state across sessions?**

---

## Chapter 4: Daily Challenges—Seeded Random Number Generation

### The Challenge

In a typical puzzle game, you want:
- ✅ Players to see the same puzzle on the same day (fairness + sharable results)
- ✅ Different puzzle every day
- ✅ Randomization for variety

JavaScript has no built-in seeded random function—`Math.random()` is unseeded and non-deterministic. Calling it twice in a row gives different results.

```javascript
// JavaScript's default randomness is unseeded
Math.random() // 0.123...
Math.random() // 0.456... (different!)
```

### Solution: Linear Congruential Generator

We implemented a **Linear Congruential Generator (LCG)**, a classic algorithm for deterministic pseudo-random numbers. Given the same seed, it always produces the same sequence:

```typescript
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // LCG formula: next_seed = (a * seed + c) mod m
  // These constants are well-established for good randomness properties
  private nextSeed(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % Number.MAX_SAFE_INTEGER;
    return this.seed;
  }

  random(): number {
    return this.nextSeed() / Number.MAX_SAFE_INTEGER;
  }

  nextInt(min: number, max: number): number {
    const range = max - min;
    if (range <= 0) {
      throw new Error("Invalid range for nextInt: max must be greater than min.");
    }
    return min + Math.floor(this.random() * range);
  }

  nextItem<T>(array: T[]): T {
    const index = this.nextInt(0, array.length)
    return array[index]
  }
}
```

**How it works:**
1. Start with a seed value
2. Apply the formula: `next = (1664525 * current + 1013904223) % MAX_SAFE_INTEGER`
3. Each call to `random()` advances the seed and returns a normalized value
4. The same seed always produces the same sequence

### Generating Daily Puzzles

To create a daily puzzle, we generate a seed from the current date:

```typescript
export const generateColorPuzzle = (date: Date) => {
  // Create a deterministic seed from the date
  const seed = [
    'en-GB',              // Locale string (ensures consistency)
    date.getDate(),       // Day of month (1-31)
    date.getMonth(),      // Month (0-11)
    date.getFullYear(),   // Year (e.g., 2026)
  ].join('')

  // Two-stage random generation for better mixing
  const seedToRandom = seededRandom(seed)
  seedToRandom.random()  // Advance the seed once
  const random = seededRandom(seedToRandom.random() * Number.MAX_SAFE_INTEGER)

  // Randomly decide how many colors to mix
  const minMix = 4
  const maxMix = 12
  const mixCount = random.nextInt(minMix, maxMix)

  // Pick a random palette
  const palettes = useActivePalette().palettes;
  const palette = random.nextItem(palettes);

  // Select random colors from that palette
  const paletteMixes = Array.from({ length: mixCount }).map(() => random.nextItem(palette.palettes))
  const mixes = paletteMixes.map(e => e.value)
  
  const paletteCount = paletteMixes.reduce((a, b) => {
    a[b.name] ??= 0
    a[b.name] += 1
    return a
  }, {} as Record<string, number>)

  return {
    palette,
    paletteCount,
    mixes,
  }
}
```

**Example:**
- Today: February 20, 2026
- Seed: `'en-GB2019125'` (concatenation of locale, day 20, month 1, year 2026)
- This seed consistently produces the same puzzle throughout the day
- Tomorrow: February 21, 2026
- Seed: `'en-GB2119125'` (day increments to 21)
- Completely different puzzle, but still deterministic

### Why This Matters

This approach enables:
- **Fairness**: Everyone gets the same puzzle on the same day
- **Shareability**: Players can compare results using the date as reference
- **Variety**: A different puzzle every single day
- **No server needed**: Puzzles are generated client-side from the date

---

## Chapter 5: Game History—Persisting State with Local Storage

### The Problem

When users play and come back later, they expect:
1. Today's mix state to be saved
2. Yesterday's result to be retrievable
3. Everything to work even without a backend

### The Solution: Local Storage + Type-Safe Wrappers

We built a wrapper around the browser's `localStorage` API with TypeScript support:

```typescript
export type TaggedString<Data> = string & { _type: Data }

export function tagString<Data>(s: string) {
  return s as TaggedString<Data>
}

export function useLocalStorage() {
  function get<T>(key: string, transformer: { new(data: never | null): T }): T
  function get<Data>(key: TaggedString<Data>): Data | null
  function get<T>(key: string, transformer?: { new(data: never | null): T }): T | null {
    const value = localStorage.getItem(key)
    try {
      const parsed = value ? JSON.parse(value) : null
      return transformer ? new transformer(parsed as never) : parsed;
    } catch (error) {
      console.error("useLocalStorage error", error)
      return transformer ? new transformer(null) : null;
    }
  }

  function set<T>(key: string, value: T) {
    const stringified = JSON.stringify(value)
    localStorage.setItem(key, stringified)
  }

  function del(key: string) {
    localStorage.removeItem(key);
  }
  
  return { get, set, del }
}
```

### Storing Mix History

Each day's mix is stored with a date-based key:

```typescript
export function useMixHistory() {
  const localStorage = useLocalStorage()

  function generateKeyFromDate(date: Date) {
    const key = [
      'mix-history',
      date.getDate(),      // Day
      date.getMonth(),     // Month
      date.getFullYear(),  // Year
    ].join(':')
    return tagString<MixHistory>(key)
  }

  const todaysKey = generateKeyFromDate(new Date())
  
  return {
    saveTodaysMix(mixes: Mixes, name: string) {
      localStorage.set(todaysKey, {
        name: name,
        mixes,
      })
    },
    get todaysMix() {
      return localStorage.get(todaysKey)
    },
    get yesterdaysMix() {
      const date = new Date
      date.setDate(date.getDate() - 1)
      return localStorage.get(generateKeyFromDate(date))
    },
  }
}
```

### Auto-Saving During Gameplay

The mix state is saved every time the player modifies it:

```typescript
export function useActivePalette() {
  const mixHistory = useMixHistory()

  return {
    addMix(palette: PaletteItem) {
      activeMix.value[palette.name] ??= 0
      activeMix.value[palette.name] += 1
      // Save immediately after every change
      mixHistory.saveTodaysMix(activeMix.value, this.activePalette.name);
    },
    reduceMix(palette: PaletteItem) {
      activeMix.value[palette.name] ??= 0
      activeMix.value[palette.name] -= 1
      activeMix.value[palette.name] = Math.max(0, activeMix.value[palette.name])
      // Save immediately after every change
      mixHistory.saveTodaysMix(activeMix.value, this.activePalette.name);
    },
  }
}
```

**Data structure stored:**
```json
{
  "mix-history:20:1:2026": {
    "name": "Standard RGB + BW",
    "mixes": {
      "Red": 3,
      "Blue": 2,
      "White": 1
    }
  }
}
```

This approach means:
- ✅ Game state persists across page refreshes
- ✅ Players can close their browser and return later
- ✅ Multiple browsers on the same device each have their own history
- ❌ History doesn't sync across devices (would need backend)

---

## Chapter 6: Modern Web APIs—Using the Native Dialog Element

### The Traditional Approach

Traditionally, creating interactive dialogs in web apps meant:

```html
<!-- Old way: Custom modal markup -->
<div class="modal" id="myModal">
  <div class="modal-content">
    <span class="close">&times;</span>
    <p>Dialog content here</p>
  </div>
</div>
```

Then managing with CSS and JavaScript:
- Custom styling for the overlay, backdrop, animations
- JavaScript to handle show/hide/positioning
- Accessibility considerations (focus trap, keyboard events)
- Boilerplate, boilerplate, boilerplate

### The Modern Solution: HTML `<dialog>` Element

HTML5 introduced the native `<dialog>` element. It handles all the complexity for you:

```html
<dialog>
  <div class="dialog-content">
    <h2>Dialog Title</h2>
    <p>Your content here</p>
    <button>Close</button>
  </dialog>
</dialog>
```

With browser-provided behavior:
- ✅ Built-in backdrop overlay
- ✅ Automatic keyboard handling (ESC to close)
- ✅ Focus management (focus trapped inside)
- ✅ Hardware-accelerated animations
- ✅ Minimal CSS needed

### Integration with Vue

Using Vue's template refs, we can interact with the native `HTMLDialogElement` API:

```vue
<script setup lang="ts">
import { ref } from 'vue';

const dialog = ref<HTMLDialogElement>()
</script>

<template>
  <!-- Dialog with Vue binding -->
  <dialog ref="dialog" class="fade-in">
    <div class="dialog-content">
      <h1 class="dialog-title">How it is calculated</h1>
      
      <p class="dialog-typo">
        Color similarity is measured based on perceptual differences using 
        the CIELAB color delta formula...
      </p>
      
      <button class="button" @click="dialog?.close()">Close</button>
    </div>
  </dialog>

  <!-- Trigger button -->
  <button @click="dialog?.showModal()">Show Help</button>
</template>
```

That's it! No complex state management, no custom CSS for modals.

### Styling the Dialog

The `<dialog>` element can be styled with standard CSS, and we added a few modern touches:

```css
dialog {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border: 0;
  border-radius: 16px;
  min-width: 300px;
}

/* Fade-in animation */
@keyframes fadeIn {
  from {
    opacity: 0;
    top: 49%;
  }
  to {
    opacity: 1;
    top: 50%;
  }
}

.fade-in {
  animation: fadeIn 200ms ease-in-out forwards;
}
```

The `::backdrop` pseudo-element is automatically styled by the browser with a semi-transparent overlay.

### Multiple Dialog Examples in Our App

**Example 1: Color Similarity Explanation**
```vue
<dialog ref="dialog" class="fade-in">
  <div class="auto-layout vertical top-center gap-32">
    <div class="dialog-title">How it is calculated</div>
    <div class="dialog-typo">
      <b>Color similarity</b> is measured based on perceptual differences 
      using the CIELAB color delta formula...
    </div>
    <AppButton label="Close" @click="dialog?.close()" />
  </div>
</dialog>

<!-- Trigger with help icon -->
<i class="material-symbols-outlined" @click="dialog?.showModal()">help</i>
```

**Example 2: Yesterday's Results**
```vue
<dialog ref="dialog" class="fade-in">
  <div class="auto-layout vertical top-center gap-32">
    <div class="dialog-title">Result #{{ getDaysAfterRelease() - 1 }}</div>
    
    <MixSummary 
      :color="yesterdaysMix" 
      :name="yesterdaysPuzzle.palette.name" 
      :mixes="yesterdaysPuzzle.paletteCount" 
    />
    
    <div v-if="yesterdaysUserMix">
      Your similarity: {{ compareSimilarity(...) }}%
    </div>
    
    <AppButton label="Close" @click="dialog?.close()" />
  </div>
</dialog>

<!-- Trigger with button -->
<AppButton label="Yesterday's result" @click="showYesterdaysResult" />
```

### Browser Support & Advantages

- **Modern browsers**: Full support in Chrome, Firefox, Safari, Edge
- **Fallback**: Older browsers can use a polyfill or detect via feature testing
- **Performance**: Dialog management is handled by the browser, not JavaScript
- **Accessibility**: Built-in ARIA semantics and keyboard handling

The `<dialog>` element represents a shift toward letting browsers handle UI complexity natively, reducing framework overhead.
