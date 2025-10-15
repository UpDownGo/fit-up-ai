import React from 'react';
import { HistoryItem } from '../types';
import { useLocalization } from '../context/LocalizationContext';

interface HistoryProps {
  history: HistoryItem[];
  onClearHistory: () => void;
}

export const History: React.FC<HistoryProps> = ({ history, onClearHistory }) => {
  const { t, language } = useLocalization();

  if (history.length === 0) {
    return null;
  }

  const formatTimestamp = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString(language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return ''; // Return empty string if date is invalid
    }
  };


  return (
    <section className="w-full mt-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-300">{t('historyTitle')}</h2>
        <button 
          onClick={onClearHistory} 
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold text-sm transition-colors duration-300"
        >
          {t('clearHistoryButton')}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {history.map(item => (
          <div key={item.id} className="flex flex-col items-center gap-2">
            <div className="group relative aspect-square w-full transform transition-transform duration-300 hover:scale-105">
              <img src={item.generatedImage} alt="Generated try-on" className="w-full h-full object-cover rounded-lg shadow-md" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-end p-2 rounded-lg">
                <a 
                  href={item.generatedImage} 
                  download={`virtual-try-on-${item.id}.png`} 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold text-sm transform translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100"
                  style={{ transition: 'transform 0.3s ease-out, opacity 0.3s ease-out' }}
                >
                  {t('downloadButton')}
                </a>
              </div>
            </div>
            <p className="text-xs text-center text-gray-400">{formatTimestamp(item.id)}</p>
          </div>
        ))}
      </div>
    </section>
  );
};