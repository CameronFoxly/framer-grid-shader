# Interactive WebGL Grid Shader for Framer

A Framer custom code component that creates an interactive grid of squares that respond to mouse movement with smooth animations. Built with WebGL for optimal performance.

Note: Vibe-coded with GitHub Copilot, so excuse some of the clunky formatting. The `particleshader.tsx` file is for testing locally with a custom UI for testing values, and then the `Framerparticleshader.tsx` file is the one that actually goes into Framer and exposes those controls as properties. 

## Features

- Responsive grid of squares that react to mouse proximity
- Smooth animations with configurable easing durations
- Customizable colors for foreground and background
- Adjustable parameters:
  - Proximity range
  - Minimum and maximum square sizes
  - Animation durations
  - Colors

## Installation

1. Clone the repository:
```bash
git clone https://github.com/cameronfoxly/framer-grid-shader.git
cd framer-grid-shader
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Usage

Copy and paste the entire code from `src/components/FramerParticleShader.tsx` into a new Code File set to `override`. Then use it like you would any component.

## Controls

The shader comes with a built-in control panel that allows you to adjust:
- Front color
- Background color
- Proximity range (50px - 500px)
- Minimum square size (0px - max size)
- Maximum square size (20px - 100px)
- Ease-in duration (0.1s - 1.0s)
- Ease-out duration (0.1s - 1.0s)

## License

MIT
