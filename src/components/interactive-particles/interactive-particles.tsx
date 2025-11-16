import { useEffect, useRef } from "react";
import InteractiveCanvas from "./scripts/interactive-canvas.ts";
import { twMerge } from "tailwind-merge";

interface InteractiveParticlesProps {
    image: string;
    threshold?: number;
    density?: number;
    color?: string;
    size?: number;
    className?: string;
}

const InteractiveParticles: React.FC<InteractiveParticlesProps> = ({
    image,
    threshold = 200,
    density = 1,
    color = "#0047bb",
    size = 0.8,
    className,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<InteractiveCanvas | null>(null);

    useEffect(() => {
        const initializeParticles = async () => {
            if (!containerRef.current || !image) return;

            try {
                canvasRef.current = new InteractiveCanvas(
                    image,
                    containerRef.current,
                    threshold,
                    density,
                    color,
                    size
                );

                canvasRef.current.enableControls();
            } catch (error) {
                console.error("Failed to load interactive particles:", error);
            }
        };

        initializeParticles();

        return () => {
            canvasRef.current?.dispose();
            canvasRef.current = null;
        };
    }, [image, threshold, density, color, size]);

    return (
        <div
            ref={containerRef}
            className={twMerge(
                "relative z-3 h-full w-full overflow-hidden",
                className
            )}
            role="application"
        ></div>
    );
};

export default InteractiveParticles;
