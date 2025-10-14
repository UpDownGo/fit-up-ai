import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BoundingBox } from '../types';
import { useLocalization } from '../context/LocalizationContext';

interface ImageEditorProps {
  imageSrc: string;
  onBoxDrawn: (box: BoundingBox) => void;
  boxColor: string;
  instruction: string;
  existingBox?: BoundingBox | null;
  garmentBox?: BoundingBox | null;
}

type DragState = 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | null;

const HANDLE_SIZE = 12;

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, onBoxDrawn, boxColor, instruction, existingBox = null, garmentBox = null }) => {
  const { t } = useLocalization();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Desktop drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [box, setBox] = useState<BoundingBox | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  // Mobile adjustment state
  const [adjustableBox, setAdjustableBox] = useState<BoundingBox | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);

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

      const drawStyledBox = (b: BoundingBox, color: string, lineWidth: number, isAdjustable: boolean = false) => {
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        context.strokeRect(b.x, b.y, b.width, b.height);

        if (isAdjustable) {
          context.fillStyle = 'white';
          context.strokeStyle = 'black';
          context.lineWidth = 1;

          const handles = [
            { x: b.x, y: b.y }, // tl
            { x: b.x + b.width, y: b.y }, // tr
            { x: b.x, y: b.y + b.height }, // bl
            { x: b.x + b.width, y: b.y + b.height }, // br
          ];

          handles.forEach(handle => {
            context.beginPath();
            context.arc(handle.x, handle.y, HANDLE_SIZE / 2, 0, 2 * Math.PI);
            context.fill();
            context.stroke();
          });
        }
      };
      
      if (existingBox) {
        drawStyledBox({
          x: existingBox.x * canvas.width,
          y: existingBox.y * canvas.height,
          width: existingBox.width * canvas.width,
          height: existingBox.height * canvas.height,
        }, 'rgba(0, 128, 255, 0.7)', 3);
      }

      if (isTouchDevice && adjustableBox) {
        drawStyledBox(adjustableBox, boxColor, 3, true);
      } else if (garmentBox && !isDrawing) {
        drawStyledBox({
          x: garmentBox.x * canvas.width,
          y: garmentBox.y * canvas.height,
          width: garmentBox.width * canvas.width,
          height: garmentBox.height * canvas.height,
        }, boxColor, 3);
      }

      if (box && isDrawing) {
        drawStyledBox(box, boxColor, 3);
      }
    };
  }, [imageSrc, box, boxColor, existingBox, garmentBox, isDrawing, adjustableBox, isTouchDevice]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  useEffect(() => {
    if (isTouchDevice && !garmentBox) {
        const canvas = canvasRef.current;
        if (canvas) {
          const defaultWidth = canvas.width * 0.5;
          const defaultHeight = canvas.height * 0.5;
          setAdjustableBox({
            x: (canvas.width - defaultWidth) / 2,
            y: (canvas.height - defaultHeight) / 2,
            width: defaultWidth,
            height: defaultHeight,
          });
        }
    } else if (isTouchDevice && garmentBox && canvasRef.current) {
        const canvas = canvasRef.current;
        setAdjustableBox({
            x: garmentBox.x * canvas.width,
            y: garmentBox.y * canvas.height,
            width: garmentBox.width * canvas.width,
            height: garmentBox.height * canvas.height,
        });
    }
  }, [isTouchDevice, imageSrc, garmentBox]);


  const getCanvasPos = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // --- Desktop Mouse Handlers ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isTouchDevice) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    setIsDrawing(true);
    setStartPoint(pos);
    setBox({ ...pos, width: 0, height: 0 });
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isTouchDevice || !isDrawing || !startPoint) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    setBox({
      x: Math.min(pos.x, startPoint.x),
      y: Math.min(pos.y, startPoint.y),
      width: Math.abs(pos.x - startPoint.x),
      height: Math.abs(pos.y - startPoint.y),
    });
  };
  const handleMouseUp = () => {
    if (isTouchDevice || !isDrawing) return;
    setIsDrawing(false);
    if (!box || !canvasRef.current || box.width < 10 || box.height < 10) {
      setBox(null); return;
    }
    const canvas = canvasRef.current;
    const normalizedBox: BoundingBox = {
      x: box.x / canvas.width, y: box.y / canvas.height,
      width: box.width / canvas.width, height: box.height / canvas.height,
    };
    setBox(null);
    onBoxDrawn(normalizedBox);
  };

  // --- Mobile Touch Handlers ---
  const getDragState = (pos: { x: number, y: number }, b: BoundingBox): DragState => {
      const isNear = (p1: number, p2: number) => Math.abs(p1 - p2) < HANDLE_SIZE;
      if (isNear(pos.x, b.x) && isNear(pos.y, b.y)) return 'resize-tl';
      if (isNear(pos.x, b.x + b.width) && isNear(pos.y, b.y)) return 'resize-tr';
      if (isNear(pos.x, b.x) && isNear(pos.y, b.y + b.height)) return 'resize-bl';
      if (isNear(pos.x, b.x + b.width) && isNear(pos.y, b.y + b.height)) return 'resize-br';
      if (pos.x > b.x && pos.x < b.x + b.width && pos.y > b.y && pos.y < b.y + b.height) return 'move';
      return null;
  };
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!adjustableBox) return;
      const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
      const currentDragState = getDragState(pos, adjustableBox);
      if (currentDragState) {
          setDragState(currentDragState);
          setTouchStart(pos);
      }
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!dragState || !touchStart || !adjustableBox) return;
      const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
      const dx = pos.x - touchStart.x;
      const dy = pos.y - touchStart.y;
      
      let newBox = { ...adjustableBox };
      switch (dragState) {
          case 'move':
              newBox.x += dx; newBox.y += dy;
              break;
          case 'resize-tl':
              newBox.x += dx; newBox.y += dy; newBox.width -= dx; newBox.height -= dy;
              break;
          case 'resize-tr':
              newBox.width += dx; newBox.y += dy; newBox.height -= dy;
              break;
          case 'resize-bl':
              newBox.x += dx; newBox.width -= dx; newBox.height += dy;
              break;
          case 'resize-br':
              newBox.width += dx; newBox.height += dy;
              break;
      }

      setAdjustableBox(newBox);
      setTouchStart(pos);
  };
  const handleTouchEnd = () => {
      setDragState(null);
      setTouchStart(null);
  };

  const handleConfirmSelection = () => {
    if (!adjustableBox || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const normalizedBox: BoundingBox = {
        x: adjustableBox.x / canvas.width,
        y: adjustableBox.y / canvas.height,
        width: adjustableBox.width / canvas.width,
        height: adjustableBox.height / canvas.height,
    };
    onBoxDrawn(normalizedBox);
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4">
      <h2 className="text-2xl font-bold text-center text-indigo-300">{instruction}</h2>
      <div ref={containerRef} className="w-full touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          className={`rounded-lg shadow-lg ${isTouchDevice ? '' : 'cursor-crosshair'}`}
        />
      </div>
      {isTouchDevice && !garmentBox && (
         <button 
            onClick={handleConfirmSelection}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition-colors duration-300"
        >
            {t('confirmSelectionButton')}
        </button>
      )}
    </div>
  );
};
