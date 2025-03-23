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
    
    // Cache WebGL buffers and attribute locations
    const buffersRef = useRef<{
        square?: WebGLBuffer,
        positionAttribute?: number,
        squarePositionAttribute?: number,
        currentSizeAttribute?: number
    }>({})
    
    // Cache uniform locations
    const uniformsRef = useRef<{
        modelView?: WebGLUniformLocation | null,
        projection?: WebGLUniformLocation | null,
        mousePosition?: WebGLUniformLocation | null,
        maxDistance?: WebGLUniformLocation | null,
        minSize?: WebGLUniformLocation | null,
        maxSize?: WebGLUniformLocation | null,
        frontColor?: WebGLUniformLocation | null
    }>({})

    // Handle canvas resize
    const resizeCanvas = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Get the display size of the canvas
        const displayWidth = canvas.clientWidth
        const displayHeight = canvas.clientHeight

        // Check if the canvas is not the same size
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            // Make the canvas the same size
            canvas.width = displayWidth
            canvas.height = displayHeight

            // Update the WebGL viewport
            const gl = glRef.current
            if (gl) {
                gl.viewport(0, 0, displayWidth, displayHeight)
            }

            // Recreate the grid with new dimensions
            squaresRef.current = createGrid(displayWidth, displayHeight, maxSize)
        }
    }

    // Add resize handler
    useEffect(() => {
        const handleResize = () => {
            resizeCanvas()
        }

        window.addEventListener('resize', handleResize)
        // Initial resize
        resizeCanvas()

        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [maxSize])

    // Update mouse position with proper scaling
    const updateMousePosition = (e: MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        mousePositionRef.current = [x, y]
    }

    useEffect(() => {
        window.addEventListener("mousemove", updateMousePosition)
        return () => window.removeEventListener("mousemove", updateMousePosition)
    }, [])

    // Convert colors to RGB arrays
    const colorToRGB = (color: string): [number, number, number] => {
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1], 10) / 255
            const g = parseInt(rgbMatch[2], 10) / 255
            const b = parseInt(rgbMatch[3], 10) / 255
            return [r, g, b]
        }
        return [0, 0, 0]
    }

    const frontColorRGB = colorToRGB(frontColor)
    const backColorRGB = colorToRGB(backColor)

    // Create and cache static buffers and attributes
    const initBuffersAndAttributes = (gl: WebGLRenderingContext, program: WebGLProgram) => {
        // Create square vertices once
        const squareVertices = new Float32Array([
            -0.5, -0.5,
             0.5, -0.5,
             0.5,  0.5,
            -0.5,  0.5
        ])

        const squareBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, squareVertices, gl.STATIC_DRAW)

        // Cache buffer and attribute locations
        buffersRef.current = {
            square: squareBuffer,
            positionAttribute: gl.getAttribLocation(program, "position"),
            squarePositionAttribute: gl.getAttribLocation(program, "squarePosition"),
            currentSizeAttribute: gl.getAttribLocation(program, "currentSize")
        }

        // Cache uniform locations
        uniformsRef.current = {
            modelView: gl.getUniformLocation(program, "modelViewMatrix"),
            projection: gl.getUniformLocation(program, "projectionMatrix"),
            mousePosition: gl.getUniformLocation(program, "mousePosition"),
            maxDistance: gl.getUniformLocation(program, "maxDistance"),
            minSize: gl.getUniformLocation(program, "minSize"),
            maxSize: gl.getUniformLocation(program, "maxSize"),
            frontColor: gl.getUniformLocation(program, "frontColor")
        }
    }

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

    // Optimized grid creation with precalculated values
    const createGrid = (width: number, height: number, squareSize: number) => {
        const squares: Square[] = []
        const spacing = squareSize / 2
        const cols = Math.ceil(width / spacing) + 1
        const rows = Math.ceil(height / spacing) + 1

        squares.length = cols * rows // Pre-allocate array
        let index = 0

        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                squares[index++] = {
                    position: [x * spacing, y * spacing],
                    scale: 1.0,
                    currentSize: maxSize,
                    targetSize: maxSize,
                    lastUpdateTime: 0
                }
            }
        }

        return squares
    }

    const render = (timestamp: number) => {
        const gl = glRef.current
        const program = programRef.current
        if (!gl || !program) return

        const deltaTime = (timestamp - lastTimeRef.current) / 1000
        lastTimeRef.current = timestamp

        gl.clearColor(backColorRGB[0], backColorRGB[1], backColorRGB[2], 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        const modelViewMatrix = mat4.create()
        const projectionMatrix = mat4.create()
        mat4.ortho(projectionMatrix, 0, gl.canvas.width, gl.canvas.height, 0, -1, 1)

        // Use cached uniform locations
        const uniforms = uniformsRef.current
        const buffers = buffersRef.current

        // Set uniforms using cached locations
        gl.uniformMatrix4fv(uniforms.modelView!, false, modelViewMatrix)
        gl.uniformMatrix4fv(uniforms.projection!, false, projectionMatrix)
        gl.uniform2f(uniforms.mousePosition!, mousePositionRef.current[0], mousePositionRef.current[1])
        gl.uniform1f(uniforms.maxDistance!, proximityRange)
        gl.uniform1f(uniforms.minSize!, minSize)
        gl.uniform1f(uniforms.maxSize!, maxSize)
        gl.uniform3f(uniforms.frontColor!, frontColorRGB[0], frontColorRGB[1], frontColorRGB[2])

        // Set up vertex attributes using cached buffer and locations
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.square!)
        gl.enableVertexAttribArray(buffers.positionAttribute!)
        gl.vertexAttribPointer(buffers.positionAttribute!, 2, gl.FLOAT, false, 0, 0)

        // Cache squared proximity range for faster distance checks
        const proximityRangeSquared = proximityRange * proximityRange
        const mousePos = mousePositionRef.current

        // Draw each square with optimized distance calculation
        squaresRef.current.forEach((square) => {
            const dx = square.position[0] - mousePos[0]
            const dy = square.position[1] - mousePos[1]
            // Use squared distance to avoid square root
            const distSquared = dx * dx + dy * dy
            
            // Calculate target size based on squared distance
            const distanceScale = Math.min(distSquared / proximityRangeSquared, 1.0)
            const newTargetSize = minSize + (maxSize - minSize) * Math.sqrt(distanceScale)
            
            square.targetSize = newTargetSize
            
            const timeDiff = (timestamp - square.lastUpdateTime) / 1000
            const easeDuration = square.currentSize > square.targetSize ? easeInDuration : easeOutDuration
            const t = Math.min(timeDiff / easeDuration, 1.0)
            square.currentSize += (square.targetSize - square.currentSize) * t
            square.lastUpdateTime = timestamp

            gl.vertexAttrib2f(buffers.squarePositionAttribute!, square.position[0], square.position[1])
            gl.vertexAttrib1f(buffers.currentSizeAttribute!, square.currentSize)

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
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        glRef.current = gl
        programRef.current = program

        // Initialize buffers and attributes
        initBuffersAndAttributes(gl, program)

        // Create initial grid
        squaresRef.current = createGrid(canvas.width, canvas.height, maxSize)

        render(0)

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
            // Cleanup WebGL resources
            if (gl) {
                gl.deleteBuffer(buffersRef.current.square!)
                gl.deleteProgram(program)
            }
        }
    }, [maxSize, frontColorRGB, backColorRGB, proximityRange, minSize, easeInDuration, easeOutDuration])

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: "100%",
                height: "100%",
                display: "block" // Prevent extra space at bottom
            }}
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