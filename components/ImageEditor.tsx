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

const HANDLE_SIZE = 16; // Larger for easier touch
const MIN_BOX_SIZE = 20;

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, onBoxDrawn, boxColor, instruction, existingBox = null, garmentBox = null }) => {
  const { t } = useLocalization();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // General state
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Desktop drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [desktopBox, setDesktopBox] = useState<BoundingBox | null>(null);
  
  // Mobile adjustment state
  const [adjustableBox, setAdjustableBox] = useState<BoundingBox | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Effect to initialize or update the adjustable box, syncing with the parent's `garmentBox`
  useEffect(() => {
    if (canvasSize.width === 0) return;

    // The confirmed `garmentBox` from the parent is the source of truth.
    if (garmentBox) {
        setAdjustableBox({
            x: garmentBox.x * canvasSize.width,
            y: garmentBox.y * canvasSize.height,
            width: garmentBox.width * canvasSize.width,
            height: garmentBox.height * canvasSize.height,
        });
    } else if (isTouchDevice && !adjustableBox) { // Only set a default box on initial load for touch devices
        const defaultWidth = canvasSize.width * 0.5;
        const defaultHeight = canvasSize.height * 0.5;
        setAdjustableBox({
            x: (canvasSize.width - defaultWidth) / 2,
            y: (canvasSize.height - defaultHeight) / 2,
            width: defaultWidth,
            height: defaultHeight,
        });
    }
  }, [isTouchDevice, garmentBox, canvasSize.width, canvasSize.height]);


  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const container = containerRef.current;
    if (!canvas || !context || !container) return;

    const image = new Image();
    image.src = imageSrc;

    image.onload = () => {
      const containerWidth = container.clientWidth;
      if (containerWidth === 0) return;

      const imageAspectRatio = image.naturalWidth / image.naturalHeight;
      const canvasHeight = containerWidth / imageAspectRatio;
      
      canvas.width = containerWidth;
      canvas.height = canvasHeight;
      
      if (canvasSize.width !== canvas.width || canvasSize.height !== canvas.height) {
        setCanvasSize({ width: canvas.width, height: canvas.height });
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const drawStyledBox = (b: BoundingBox, color: string, lineWidth: number, isAdjustable: boolean = false) => {
        context.save();
        
        if (isAdjustable && dragState) {
           context.setLineDash([6, 4]); // Dashed line while manipulating
        }
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        context.strokeRect(b.x, b.y, b.width, b.height);
        context.restore(); // Restore to solid line

        if (isAdjustable) {
          context.strokeStyle = 'rgba(0,0,0,0.5)';
          context.lineWidth = 2;

          const handles = [
            { x: b.x, y: b.y, state: 'resize-tl' as DragState }, // tl
            { x: b.x + b.width, y: b.y, state: 'resize-tr' as DragState }, // tr
            { x: b.x, y: b.y + b.height, state: 'resize-bl' as DragState }, // bl
            { x: b.x + b.width, y: b.y + b.height, state: 'resize-br' as DragState }, // br
          ];

          handles.forEach(handle => {
            context.fillStyle = (dragState === handle.state) ? 'rgba(59, 130, 246, 1)' : 'white';
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

      // Drawing logic: Mouse drawing takes precedence over other displays.
      if (isDrawing && desktopBox) {
        // Always show the box being drawn with the mouse.
        drawStyledBox(desktopBox, boxColor, 3);
      } else if (isTouchDevice) {
        // On touch devices, show the adjustable box when not drawing with a mouse.
        if (adjustableBox) {
          drawStyledBox(adjustableBox, boxColor, 3, true);
        }
      } else if (garmentBox) {
        // On non-touch devices, show the final selected box.
         drawStyledBox({
              x: garmentBox.x * canvas.width,
              y: garmentBox.y * canvas.height,
              width: garmentBox.width * canvas.width,
              height: garmentBox.height * canvas.height,
         }, boxColor, 3);
      }
    };
  }, [imageSrc, desktopBox, boxColor, existingBox, garmentBox, isDrawing, adjustableBox, isTouchDevice, canvasSize, dragState]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);


  const getCanvasPos = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // --- Desktop Mouse Handlers (now enabled on all devices) ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    setIsDrawing(true);
    setStartPoint(pos);
    setDesktopBox({ ...pos, width: 0, height: 0 });
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    setDesktopBox({
      x: Math.min(pos.x, startPoint.x),
      y: Math.min(pos.y, startPoint.y),
      width: Math.abs(pos.x - startPoint.x),
      height: Math.abs(pos.y - startPoint.y),
    });
  };
  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (!desktopBox || !canvasRef.current || desktopBox.width < 10 || desktopBox.height < 10) {
      setDesktopBox(null); return;
    }
    const canvas = canvasRef.current;
    const normalizedBox: BoundingBox = {
      x: desktopBox.x / canvas.width, y: desktopBox.y / canvas.height,
      width: desktopBox.width / canvas.width, height: desktopBox.height / canvas.height,
    };
    setDesktopBox(null);
    onBoxDrawn(normalizedBox);
  };

  // --- Mobile Touch Handlers ---
  const getDragStateForPos = (pos: { x: number, y: number }, b: BoundingBox): DragState => {
      const isNear = (p1: number, p2: number) => Math.abs(p1 - p2) < HANDLE_SIZE * 1.5; // Increased touch area
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
      const currentDragState = getDragStateForPos(pos, adjustableBox);
      if (currentDragState) {
          e.preventDefault();
          setDragState(currentDragState);
          setTouchStart(pos);
      }
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!dragState || !touchStart || !adjustableBox) return;
      e.preventDefault();
      
      const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
      const clampedPos = {
          x: Math.max(0, Math.min(pos.x, canvasSize.width)),
          y: Math.max(0, Math.min(pos.y, canvasSize.height)),
      };
      
      let nextBox = { ...adjustableBox };
      const dx = clampedPos.x - touchStart.x;
      const dy = clampedPos.y - touchStart.y;

      if (dragState === 'move') {
          nextBox.x = Math.max(0, Math.min(nextBox.x + dx, canvasSize.width - nextBox.width));
          nextBox.y = Math.max(0, Math.min(nextBox.y + dy, canvasSize.height - nextBox.height));
      } else {
          // Handle Resizing
          let { x, y, width, height } = nextBox;
          
          switch (dragState) {
              case 'resize-tl':
                  x += dx; y += dy;
                  width -= dx; height -= dy;
                  break;
              case 'resize-tr':
                  width += dx;
                  y += dy; height -= dy;
                  break;
              case 'resize-bl':
                  x += dx; width -= dx;
                  height += dy;
                  break;
              case 'resize-br':
                  width += dx; height += dy;
                  break;
          }

          // Handle inversion (flipping the box) and minimum size
          if (width < MIN_BOX_SIZE) {
            if (dragState === 'resize-tl' || dragState === 'resize-bl') x = nextBox.x + nextBox.width - MIN_BOX_SIZE;
            width = MIN_BOX_SIZE;
          }
          if (height < MIN_BOX_SIZE) {
            if (dragState === 'resize-tl' || dragState === 'resize-tr') y = nextBox.y + nextBox.height - MIN_BOX_SIZE;
            height = MIN_BOX_SIZE;
          }

          nextBox = { x, y, width, height };
      }
      
      setAdjustableBox(nextBox);
      setTouchStart(clampedPos);
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setDragState(null);
      setTouchStart(null);
  };

  const handleConfirmSelection = () => {
    if (!adjustableBox || !canvasRef.current || canvasRef.current.width === 0) return;
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
      <h2 className="text-2xl font-bold text-center text-indigo-300">{isTouchDevice ? t('step5InstructionMobile') : instruction}</h2>
      <div ref={containerRef} className="w-full touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          className={`rounded-lg shadow-lg ${!isDrawing ? 'cursor-crosshair' : ''}`}
        />
      </div>
      {isTouchDevice && (
         <button 
            onClick={handleConfirmSelection}
            disabled={!adjustableBox}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {t('confirmSelectionButton')}
        </button>
      )}
    </div>
  );
};