# Pocket Voyagers!
Summon voyagers around your screen.

## Demo Page
Visit the [demo page](https://welsey0.github.io/pvoyagers) to see Pocket Voyagers in action! You can also find the **bookmarklet** there as a draggable link.

## Setup
pvoyagers.js uses ES stuff so it needs to be imported as a module (it won't work if you just open index.html). You can set up a simple server for testing by just running `python -m http.server` in the repo root and going to localhost:8000.

Example of how to put it on a page
```
html
<script type="module">
  import { summonVoyagers } from './pvoyagers.js';
  summonVoyagers(4);
</script>
```

Everything is also attached to window, so you can run commands straight from the browser console.

## Commands

- summonVoyagers(count = 1, theme, options = {}): Spawns voyagers. Cycles through themes if none is given.
- etVoyagerBounds(target): Confines all voyagers to an element on the page
- setVoyagerDebug(enabled): Draw a box and some information on each voyager.
- clearVoyagers(): Removes all voyagers from the screen.

## Individual Voyager Controls
Each individual voyager is an object in a list so they can be controlled individually or in groups.

- v.setPose(nameOrDef): Hold a pose until told to do otherwise.
- v.resumeBehavior(): Clears the pose and lets the voyager decide what to do again.
- v.setExpression(nameOrDef, frames = 0): Sets a facial expression (optionally for a set number of frames).
- v.setEyes(left, right = left, frames = 0): Sets individual eye shapes.
- v.setBounds(target): Sets boundaries for a specific voyager.
- v.setDebug(enabled): Toggles debug info for a specific voyager.
- v.destroy(): Removed this specific voyager.

## Options & Presets
Voyagers have various customizable options, you can use built in presets or build your own.

- Themes (VOYAGER_THEMES)
- Poses (VOYAGER_POSES)
- Expressions (VOYAGER_EXPRESSIONS)
- Eye Shapes (VOYAGER_EYE_SHAPES)

Consult the files for more information and examples on how these things work.