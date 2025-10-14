import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DetectedPerson } from '../types';
import { useLocalization } from '../context/LocalizationContext';

interface PersonSelectorProps {
  imageSrc: string;
  people: DetectedPerson[];
  onPersonSelected: (person: DetectedPerson) => void;
}

export const PersonSelector: React.FC<PersonSelectorProps> = ({ imageSrc, people, onPersonSelected }) => {
  const { t } = useLocalization();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);

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

      people.forEach(person => {
        const isHovered = person.id === hoveredPersonId;
        context.strokeStyle = isHovered ? 'rgba(59, 130, 246, 1)' : 'rgba(255, 255, 255, 0.7)';
        context.lineWidth = isHovered ? 4 : 2;
        context.strokeRect(
          person.box.x * canvas.width,
          person.box.y * canvas.height,
          person.box.width * canvas.width,
          person.box.height * canvas.height
        );

        context.fillStyle = isHovered ? 'rgba(59, 130, 246, 1)' : 'rgba(0, 0, 0, 0.6)';
        const textWidth = context.measureText(person.id).width;
        context.fillRect(
          person.box.x * canvas.width,
          person.box.y * canvas.height - 20,
          textWidth + 10,
          20
        );
        context.fillStyle = 'white';
        context.font = '14px sans-serif';
        context.fillText(person.id, person.box.x * canvas.width + 5, person.box.y * canvas.height - 5);
      });
    };
  }, [imageSrc, people, hoveredPersonId]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedPerson = people.find(person => {
        const pBox = {
            x: person.box.x * canvas.width,
            y: person.box.y * canvas.height,
            width: person.box.width * canvas.width,
            height: person.box.height * canvas.height,
        };
        return x >= pBox.x && x <= pBox.x + pBox.width && y >= pBox.y && y <= pBox.y + pBox.height;
    });

    if (clickedPerson) {
        onPersonSelected(clickedPerson);
    }
  };


  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col lg:flex-row items-start gap-8">
        <div className="w-full lg:w-2/3 flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-center text-indigo-300">{t('step2Title')}</h2>
            <div ref={containerRef} className="w-full">
                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseMove={(e) => {
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        const found = people.find(person => {
                            const pBox = {
                                x: person.box.x * canvas.width,
                                y: person.box.y * canvas.height,
                                width: person.box.width * canvas.width,
                                height: person.box.height * canvas.height,
                            };
                            return x >= pBox.x && x <= pBox.x + pBox.width && y >= pBox.y && y <= pBox.y + pBox.height;
                        });
                        setHoveredPersonId(found ? found.id : null);
                    }}
                    onMouseLeave={() => setHoveredPersonId(null)}
                    className="cursor-pointer rounded-lg shadow-lg"
                />
            </div>
        </div>
        <div className="w-full lg:w-1/3">
            <h3 className="text-lg font-semibold mb-3 text-gray-200">{t('detectedPeople')}</h3>
            <div className="flex flex-col gap-2">
                {people.length > 0 ? people.map(person => (
                    <button
                        key={person.id}
                        onClick={() => onPersonSelected(person)}
                        onMouseEnter={() => setHoveredPersonId(person.id)}
                        onMouseLeave={() => setHoveredPersonId(null)}
                        className={`w-full text-left p-3 rounded-md transition-colors duration-200 ${hoveredPersonId === person.id ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                        {person.id}
                    </button>
                )) : <p className="text-gray-400">{t('noPeopleDetected')}</p>}
            </div>
        </div>
    </div>
  );
};