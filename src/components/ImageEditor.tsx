import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BoundingBox } from '../types';

interface ImageEditorProps {
  imageSrc: string;
  onBoxDrawn: (box: BoundingBox) => void;
  boxColor: string;
  instruction: string;
  existingBox?: BoundingBox | null; // Person box
  garmentBox?: BoundingBox | null; // Garment box
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, onBoxDrawn, boxColor, instruction, existingBox = null, garmentBox = null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [box, setBox] = useState<BoundingBox | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      if (!canvas || !context) return;
      
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const imageAspectRatio = image.naturalWidth / image.naturalHeight;
      const canvasHeight = containerWidth / imageAspectRatio;
      
      canvas.width = containerWidth;
      canvas.height = canvasHeight;

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const drawBox = (b: BoundingBox, color: string) => {
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.strokeRect(b.x, b.y, b.width, b.height);
      };

      if (existingBox) {
         drawBox({
            x: existingBox.x * canvas.width,
            y: existingBox.y * canvas.height,
            width: existingBox.width * canvas.width,
            height: existingBox.height * canvas.height,
        }, 'rgba(0, 128, 255, 0.7)'); // A different color for existing box
      }
      
      if (garmentBox && !isDrawing) {
        drawBox({
            x: garmentBox.x * canvas.width,
            y: garmentBox.y * canvas.height,
            width: garmentBox.width * canvas.width,
            height: garmentBox.height * canvas.height,
        }, boxColor);
      }

      if (box) {
        drawBox(box, boxColor);
      }
    };
  }, [imageSrc, box, boxColor, existingBox, garmentBox, isDrawing]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setIsDrawing(true);
    setStartPoint(pos);
    setBox({ ...pos, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;
    const pos = getMousePos(e);
    setBox({
      x: Math.min(pos.x, startPoint.x),
      y: Math.min(pos.y, startPoint.y),
      width: Math.abs(pos.x - startPoint.x),
      height: Math.abs(pos.y - startPoint.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (!box || !canvasRef.current || box.width < 5 || box.height < 5) {
      setBox(null);
      return;
    };

    const canvas = canvasRef.current;
    const normalizedBox: BoundingBox = {
      x: box.x / canvas.width,
      y: box.y / canvas.height,
      width: box.width / canvas.width,
      height: box.height / canvas.height,
    };
    
    setBox(null);
    onBoxDrawn(normalizedBox);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold text-center text-indigo-300">{instruction}</h2>
        <div ref={containerRef} className="w-full">
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-crosshair rounded-lg shadow-lg"
            />
        </div>
    </div>
  );
};