# Interactive WebGL Grid Shader

A React component that creates an interactive grid of squares that respond to mouse movement with smooth animations. Built with WebGL for optimal performance.

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
git clone https://github.com/cameronfoxly/shader.git
cd shader
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

Import the `ParticleShader` component into your React application:

```jsx
import { ParticleShader } from './components/ParticleShader';

function App() {
  return (
    <ParticleShader />
  );
}
```

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
