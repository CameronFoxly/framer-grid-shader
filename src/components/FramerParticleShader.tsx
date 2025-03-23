import { useEffect, useRef } from "react"
import { mat4 } from "gl-matrix"
import { addPropertyControls, ControlType } from "framer"

interface Square {
    position: [number, number]
    scale: number
    currentSize: number
    targetSize: number
    lastUpdateTime: number
}

interface ShaderProps {
    frontColor: string
    backColor: string
    proximityRange: number
    minSize: number
    maxSize: number
    easeInDuration: number
    easeOutDuration: number
}

const vertexShaderSource = `attribute vec2 position;
attribute vec2 squarePosition;
attribute float currentSize;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 mousePosition;
uniform float maxDistance;
uniform float minSize;
uniform float maxSize;
uniform float easeInDuration;
uniform float easeOutDuration;

varying vec2 vUv;

void main() {
    vUv = position;
    
    // Scale position (-0.5 to 0.5) to current pixel size
    vec2 pixelPos = position * currentSize;
    
    // Add to the square position with half offset for centering
    vec2 finalPos = squarePosition + pixelPos - vec2(currentSize/4.0);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 0.0, 1.0);
}`

const fragmentShaderSource = `precision mediump float;

varying vec2 vUv;

uniform vec3 frontColor;

void main() {
    // Draw a square
    vec2 center = vUv - vec2(0.5);
    float dist = max(abs(center.x), abs(center.y));
    
    // Sharp edges for testing
    float alpha = 1.0 - step(0.5, dist);
    
    // Use front color with alpha
    gl_FragColor = vec4(frontColor, alpha);
}`

export function FramerParticleShader({
    frontColor = "#c8e6ff",
    backColor = "#b4dcff",
    proximityRange = 200,
    minSize = 0,
    maxSize = 20,
    easeInDuration = 0.2,
    easeOutDuration = 0.5
}: ShaderProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const glRef = useRef<WebGLRenderingContext | null>(null)
    const programRef = useRef<WebGLProgram | null>(null)
    const squaresRef = useRef<Square[]>([])
    const animationFrameRef = useRef<number>(0)
    const mousePositionRef = useRef<[number, number]>([0, 0])
    const lastTimeRef = useRef<number>(0)

    // Convert colors to RGB arrays
    const colorToRGB = (color: string): [number, number, number] => {
        // Parse RGB format (handling the case where it might have a # prefix)
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1], 10) / 255
            const g = parseInt(rgbMatch[2], 10) / 255
            const b = parseInt(rgbMatch[3], 10) / 255
            return [r, g, b]
        }
        
        return [0, 0, 0] // Fallback to black if parsing fails
    }

    // Convert colors
    const frontColorRGB = colorToRGB(frontColor)
    const backColorRGB = colorToRGB(backColor)

    useEffect(() => {
        // Colors updated
    }, [frontColor, backColor])

    const initShaders = (gl: WebGLRenderingContext) => {
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
        gl.shaderSource(vertexShader, vertexShaderSource)
        gl.compileShader(vertexShader)

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader))
            return null
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
        gl.shaderSource(fragmentShader, fragmentShaderSource)
        gl.compileShader(fragmentShader)

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader))
            return null
        }

        const program = gl.createProgram()!
        gl.attachShader(program, vertexShader)
        gl.attachShader(program, fragmentShader)
        gl.linkProgram(program)

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program))
            return null
        }

        return program
    }

    const createGrid = (width: number, height: number, squareSize: number) => {
        const squares: Square[] = []
        const spacing = squareSize / 2

        for (let x = 0; x < width + squareSize; x += spacing) {
            for (let y = 0; y < height + squareSize; y += spacing) {
                squares.push({
                    position: [x, y],  // Use actual position without offset
                    scale: 1.0,
                    currentSize: maxSize,
                    targetSize: maxSize,
                    lastUpdateTime: 0
                })
            }
        }

        return squares
    }

    const render = (timestamp: number) => {
        const gl = glRef.current
        const program = programRef.current
        if (!gl || !program) return

        // Update animation times
        const deltaTime = (timestamp - lastTimeRef.current) / 1000 // Convert to seconds
        lastTimeRef.current = timestamp

        // Clear with background color
        gl.clearColor(...backColorRGB, 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        const modelViewMatrix = mat4.create()
        const projectionMatrix = mat4.create()
        mat4.ortho(projectionMatrix, 0, gl.canvas.width, gl.canvas.height, 0, -1, 1)

        // Get uniform locations
        const modelViewUniform = gl.getUniformLocation(program, "modelViewMatrix")
        const projectionUniform = gl.getUniformLocation(program, "projectionMatrix")
        const mousePositionUniform = gl.getUniformLocation(program, "mousePosition")
        const maxDistanceUniform = gl.getUniformLocation(program, "maxDistance")
        const minSizeUniform = gl.getUniformLocation(program, "minSize")
        const maxSizeUniform = gl.getUniformLocation(program, "maxSize")
        const frontColorUniform = gl.getUniformLocation(program, "frontColor")

        // Set uniforms
        gl.uniformMatrix4fv(modelViewUniform, false, modelViewMatrix)
        gl.uniformMatrix4fv(projectionUniform, false, projectionMatrix)
        gl.uniform2f(mousePositionUniform, mousePositionRef.current[0], mousePositionRef.current[1])
        gl.uniform1f(maxDistanceUniform, proximityRange)
        gl.uniform1f(minSizeUniform, minSize)
        gl.uniform1f(maxSizeUniform, maxSize)
        gl.uniform3f(frontColorUniform, ...frontColorRGB)

        // Create square vertices
        const squareVertices = new Float32Array([
            -0.5, -0.5,
             0.5, -0.5,
             0.5,  0.5,
            -0.5,  0.5
        ])

        // Create and bind buffer for square vertices
        const squareBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, squareVertices, gl.STATIC_DRAW)

        // Set up position attribute
        const positionAttribute = gl.getAttribLocation(program, "position")
        gl.enableVertexAttribArray(positionAttribute)
        gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0)

        // Draw each square
        squaresRef.current.forEach((square) => {
            const mousePos = mousePositionRef.current
            const diff = [
                square.position[0] - mousePos[0],
                square.position[1] - mousePos[1]
            ]
            const dist = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1])
            
            // Calculate target size based on distance
            const distanceScale = Math.min(dist / proximityRange, 1.0)
            const newTargetSize = minSize + (maxSize - minSize) * distanceScale
            
            // Update target size
            square.targetSize = newTargetSize
            
            // Smoothly interpolate current size towards target size
            const timeDiff = (timestamp - square.lastUpdateTime) / 1000
            const easeDuration = square.currentSize > square.targetSize ? easeInDuration : easeOutDuration
            const t = Math.min(timeDiff / easeDuration, 1.0)
            square.currentSize += (square.targetSize - square.currentSize) * t
            square.lastUpdateTime = timestamp

            const squarePositionAttribute = gl.getAttribLocation(program, "squarePosition")
            const currentSizeAttribute = gl.getAttribLocation(program, "currentSize")

            gl.vertexAttrib2f(squarePositionAttribute, square.position[0], square.position[1])
            gl.vertexAttrib1f(currentSizeAttribute, square.currentSize)

            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
        })

        animationFrameRef.current = requestAnimationFrame(render)
    }

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext("webgl", { alpha: true })
        if (!gl) {
            console.error('WebGL not supported')
            return
        }

        const program = initShaders(gl)
        if (!program) {
            console.error('Failed to initialize shaders')
            return
        }

        gl.useProgram(program)

        // Enable blending for smooth edges
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        glRef.current = gl
        programRef.current = program

        // Create grid of squares
        squaresRef.current = createGrid(canvas.width, canvas.height, maxSize)

        render(0)

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [maxSize, frontColorRGB, backColorRGB, proximityRange, minSize, easeInDuration, easeOutDuration])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect()
            const scaleX = canvas.width / rect.width
            const scaleY = canvas.height / rect.height
            
            mousePositionRef.current = [
                (e.clientX - rect.left) * scaleX,
                (e.clientY - rect.top) * scaleY
            ]
        }

        window.addEventListener("mousemove", handleMouseMove)
        return () => window.removeEventListener("mousemove", handleMouseMove)
    }, [])

    // Update grid when maxSize changes
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        squaresRef.current = createGrid(canvas.width, canvas.height, maxSize)
    }, [maxSize])

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: "100%",
                height: "100%",
            }}
            width={window.innerWidth}
            height={window.innerHeight}
        />
    )
}

// Add Framer property controls
addPropertyControls(FramerParticleShader, {
    frontColor: {
        type: ControlType.Color,
        title: "Front Color",
        defaultValue: "rgb(200, 230, 255)"  // Light blue
    },
    backColor: {
        type: ControlType.Color,
        title: "Back Color",
        defaultValue: "rgb(180, 220, 255)"  // Slightly darker light blue
    },
    proximityRange: {
        type: ControlType.Number,
        title: "Proximity Range",
        defaultValue: 200,
        min: 50,
        max: 500,
        step: 1,
        unit: "px"
    },
    minSize: {
        type: ControlType.Number,
        title: "Min Size",
        defaultValue: 0,
        min: 0,
        max: 100,
        step: 1,
        unit: "px"
    },
    maxSize: {
        type: ControlType.Number,
        title: "Max Size",
        defaultValue: 20,
        min: 20,
        max: 100,
        step: 1,
        unit: "px"
    },
    easeInDuration: {
        type: ControlType.Number,
        title: "Ease In Duration",
        defaultValue: 0.2,
        min: 0.1,
        max: 1.0,
        step: 0.1,
        unit: "s"
    },
    easeOutDuration: {
        type: ControlType.Number,
        title: "Ease Out Duration",
        defaultValue: 0.5,
        min: 0.1,
        max: 1.0,
        step: 0.1,
        unit: "s"
    }
}) 