import React, { useRef, useEffect, useCallback } from 'react';
import { network } from '../theme/palette';

interface Node {
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    vx: number;
    vy: number;
    radius: number;
}

interface NetworkGridProps {
    className?: string;
}

const NetworkGrid: React.FC<NetworkGridProps> = ({ className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const nodesRef = useRef<Node[]>([]);
    const mouseRef = useRef({ x: 0, y: 0 });
    const animationRef = useRef<number>(0);

    // Configuration
    const NODE_COUNT = 80;
    const CONNECTION_DISTANCE = 150;
    const MOUSE_RADIUS = 180;
    const NODE_COLOR = network.node;
    const NODE_COLOR_HOVER = network.nodeHover;
    const LINE_COLOR = network.line;
    const LINE_COLOR_ACTIVE = network.lineActive;

    const initNodes = useCallback((width: number, height: number) => {
        const nodes: Node[] = [];
        for (let i = 0; i < NODE_COUNT; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            nodes.push({
                x,
                y,
                baseX: x,
                baseY: y,
                vx: 0,
                vy: 0,
                radius: Math.random() * 2 + 2,
            });
        }
        nodesRef.current = nodes;
    }, []);

    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        const mouse = mouseRef.current;
        const nodes = nodesRef.current;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Update and draw nodes
        nodes.forEach((node, i) => {
            // Calculate distance from mouse
            const dx = mouse.x - node.x;
            const dy = mouse.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Mouse interaction - push nodes away
            if (dist < MOUSE_RADIUS && dist > 0) {
                const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
                const angle = Math.atan2(dy, dx);
                node.vx -= Math.cos(angle) * force * 2;
                node.vy -= Math.sin(angle) * force * 2;
            }

            // Return to base position
            const returnForce = 0.02;
            node.vx += (node.baseX - node.x) * returnForce;
            node.vy += (node.baseY - node.y) * returnForce;

            // Apply friction
            node.vx *= 0.95;
            node.vy *= 0.95;

            // Update position
            node.x += node.vx;
            node.y += node.vy;

            // Draw connections to nearby nodes
            for (let j = i + 1; j < nodes.length; j++) {
                const other = nodes[j];
                const connDx = other.x - node.x;
                const connDy = other.y - node.y;
                const connDist = Math.sqrt(connDx * connDx + connDy * connDy);

                if (connDist < CONNECTION_DISTANCE) {
                    const opacity = 1 - connDist / CONNECTION_DISTANCE;
                    
                    // Check if line is near mouse for highlighting
                    const midX = (node.x + other.x) / 2;
                    const midY = (node.y + other.y) / 2;
                    const mouseDistToLine = Math.sqrt(
                        (mouse.x - midX) ** 2 + (mouse.y - midY) ** 2
                    );
                    
                    ctx.beginPath();
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(other.x, other.y);
                    
                    if (mouseDistToLine < MOUSE_RADIUS) {
                        ctx.strokeStyle = LINE_COLOR_ACTIVE;
                        ctx.lineWidth = 1.5;
                    } else {
                        ctx.strokeStyle = LINE_COLOR;
                        ctx.lineWidth = 1;
                    }
                    ctx.globalAlpha = opacity;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }

            // Draw node
            const isNearMouse = dist < MOUSE_RADIUS;
            ctx.beginPath();
            ctx.arc(node.x, node.y, isNearMouse ? node.radius * 1.5 : node.radius, 0, Math.PI * 2);
            ctx.fillStyle = isNearMouse ? NODE_COLOR_HOVER : NODE_COLOR;
            ctx.fill();

            // Glow effect for nodes near mouse
            if (isNearMouse) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius * 3, 0, Math.PI * 2);
                const gradient = ctx.createRadialGradient(
                    node.x, node.y, node.radius,
                    node.x, node.y, node.radius * 3
                );
                gradient.addColorStop(0, network.glowInner);
                gradient.addColorStop(1, network.glowOuter);
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        });

        animationRef.current = requestAnimationFrame(animate);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initNodes(canvas.width, canvas.height);
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseLeave = () => {
            mouseRef.current = { x: -1000, y: -1000 };
        };

        // Initial setup
        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);

        // Start animation
        animationRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationRef.current);
        };
    }, [initNodes, animate]);

    return (
        <canvas
            ref={canvasRef}
            className={`fixed inset-0 pointer-events-none ${className}`}
            style={{ zIndex: 0 }}
        />
    );
};

export default NetworkGrid;
